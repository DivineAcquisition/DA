import { sendApplicationAlertEmail } from './application-email';
import {
  ACQ_GHL_FORM_ID,
  ACQ_GHL_LOCATION_ID,
  ACQ_GHL_WEBHOOK_URL,
  ACQ_PUBLIC_ORIGIN,
  GHL_PIT_TOKEN,
  qualificationSchedulePath,
  qualificationThankYouPath,
} from './config';
import { markLeadAirtable, upsertLeadFromQualification } from './leads';
import {
  ghlConfigured,
  logPipelineFailure,
  upsertAirtableLead,
  upsertGhlContact,
  writeScoreToGhl,
} from './pipeline';
import { sendRoofingCapi } from './meta-capi';
import { nichePixelEvent, parseRoofingLead, roofingNotYetPath, roofingVisitorPath } from './niche-lead';
import { scoreQualification } from './score';
import {
  ghlWebhookBody,
  isHoneypot,
  parseQualification,
  QualificationError,
  type QualificationInput,
  type QualificationPayload,
} from './qualify';

export type LeadRequestMeta = {
  ip?: string;
  userAgent?: string;
  eventSourceUrl?: string;
  fbp?: string;
  fbc?: string;
};

export type QualifyResult =
  | { ok: true; redirectTo: string; pixel?: 'Lead' | 'UnqualifiedLead'; eventId?: string }
  | { ok: false; error: string; field?: string };

const GHL_API = 'https://services.leadconnectorhq.com';

function redirectTo(host?: string): string {
  return qualificationThankYouPath(host);
}

async function postWebhook(payload: QualificationPayload): Promise<void> {
  if (!ACQ_GHL_WEBHOOK_URL) return;

  const response = await fetch(ACQ_GHL_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(ghlWebhookBody(payload)),
    cache: 'no-store',
  });

  if (!response.ok) {
    console.error('ACQ GHL webhook failed', response.status, await response.text());
  }
}

async function postForm(payload: QualificationPayload): Promise<void> {
  if (!ACQ_GHL_FORM_ID || !GHL_PIT_TOKEN || !ACQ_GHL_LOCATION_ID) return;

  const response = await fetch(`${GHL_API}/forms/${ACQ_GHL_FORM_ID}/submissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GHL_PIT_TOKEN}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      locationId: ACQ_GHL_LOCATION_ID,
      ...ghlWebhookBody(payload),
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    console.error('ACQ GHL form submit failed', response.status, await response.text());
  }
}

/**
 * Qualification pipeline. A GoHighLevel contact is created when the location
 * and PIT token are available. A missing contact does not pause the
 * application. The workspace stores the lead next. Airtable is a send
 * destination — missing PAT does not block scheduling. Score is computed
 * in-app, not read from Airtable.
 */
export async function submitLead(
  input: QualificationInput,
  host?: string,
  meta?: LeadRequestMeta,
): Promise<QualifyResult> {
  if (isHoneypot(input)) {
    return {
      ok: true,
      redirectTo: input.niche === 'roofing' ? roofingNotYetPath(host) : redirectTo(host),
    };
  }

  let payload: QualificationPayload;
  try {
    payload = input.niche === 'roofing' ? parseRoofingLead(input) : parseQualification(input);
  } catch (error) {
    if (error instanceof QualificationError) {
      return { ok: false, error: error.message, field: error.field };
    }
    return { ok: false, error: 'Check the form and try again.' };
  }

  let contactId = '';
  if (ghlConfigured()) {
    try {
      const contact = await upsertGhlContact(payload);
      contactId = contact.contactId;
    } catch (error) {
      await logPipelineFailure('ghl-contact', payload.email, error);
    }
  } else {
    console.error('ACQ GHL contact step skipped: location or PIT token is not configured');
  }

  void postWebhook(payload).catch((error) => {
    console.error('[acq:ghl-webhook]', error);
  });
  void postForm(payload).catch((error) => {
    console.error('[acq:ghl-form]', error);
  });

  const score = scoreQualification(payload);

  let leadId = '';
  let scheduleToken = '';
  let airtableRecordId: string | null = null;
  try {
    const lead = await upsertLeadFromQualification(payload, contactId);
    leadId = lead.id;
    scheduleToken = lead.schedule_token;
    airtableRecordId = lead.airtable_record_id;
  } catch (error) {
    await logPipelineFailure('workspace-lead', payload.email, error);
  }

  if (contactId) {
    try {
      await writeScoreToGhl(contactId, {
        recordId: leadId || contactId,
        readinessScore: score.readinessScore,
        qualificationResult: score.qualificationResult,
      });
    } catch (error) {
      await logPipelineFailure('ghl-score', payload.email, error);
    }
  }

  let writtenAirtableId = airtableRecordId;
  try {
    const sent = await upsertAirtableLead(payload, contactId, airtableRecordId);
    writtenAirtableId = sent.recordId;
    if (leadId) {
      await markLeadAirtable(leadId, { recordId: sent.recordId }, true);
    }
  } catch (error) {
    await logPipelineFailure('airtable-lead', payload.email, error);
    if (leadId) {
      await markLeadAirtable(
        leadId,
        { error: error instanceof Error ? error.message : 'Airtable send failed' },
        true,
      );
    }
  }

  const schedulePath =
    payload.nicheQualified === false
      ? ''
      : scheduleToken
        ? qualificationSchedulePath(host, scheduleToken)
        : '';
  try {
    await sendApplicationAlertEmail({
      payload,
      ghlContactId: contactId || undefined,
      airtableRecordId: writtenAirtableId || undefined,
      scheduleUrl: schedulePath ? `${ACQ_PUBLIC_ORIGIN}${schedulePath}` : undefined,
    });
  } catch (error) {
    await logPipelineFailure('application-email', payload.email, error);
  }

  if (payload.niche === 'roofing') {
    const pixel = nichePixelEvent(Boolean(payload.nicheQualified));
    const eventId = crypto.randomUUID();
    await sendRoofingCapi({
      eventName: pixel,
      eventId,
      eventSourceUrl: meta?.eventSourceUrl,
      email: payload.email,
      phone: payload.phone,
      firstName: payload.firstName,
      fbp: meta?.fbp,
      fbc: meta?.fbc,
      fbclid: payload.tracking.fbclid,
      clientIp: meta?.ip,
      userAgent: meta?.userAgent,
      customData: {
        content_name: 'Lead Leak Audit',
        content_category: 'roofing',
        status: payload.nicheQualified ? 'qualified' : 'unqualified',
      },
    });
    return {
      ok: true,
      redirectTo: roofingVisitorPath(
        payload,
        host,
        scheduleToken,
        schedulePath,
        redirectTo(host),
      ),
      pixel,
      eventId,
    };
  }

  return {
    ok: true,
    redirectTo: scheduleToken ? qualificationSchedulePath(host, scheduleToken) : redirectTo(host),
  };
}
