import { ACQ_SMS_CONSENT_VERSION } from '@/lib/booking-messages/copy';
import { recordBookingEvent } from '@/lib/booking-messages/transport';
import { sendApplicationAlertEmail } from './application-email';
import {
  ACQ_GHL_FORM_ID,
  ACQ_GHL_LOCATION_ID,
  ACQ_GHL_WEBHOOK_URL,
  ACQ_PUBLIC_ORIGIN,
  qualificationSchedulePath,
  qualificationThankYouPath,
} from './config';
import { markLeadAirtable, upsertLeadFromQualification } from './leads';
import {
  ghlReady,
  logPipelineFailure,
  upsertAirtableLead,
  upsertGhlContact,
  writeScoreToGhl,
} from './pipeline';
import { ghlPit } from '@/lib/ghl/pit';
import { moveGhlLead } from './ghl-lifecycle';
import { sendRoofingCapi } from './meta-capi';
import {
  frontOfficeNotYetPath,
  frontOfficeVisitorPath,
  parseFrontOfficeLead,
  withFrontOfficeTouch,
} from './front-office-lead';
import { nichePixelEvent, parseRoofingLead, roofingNotYetPath, roofingVisitorPath } from './niche-lead';
import { AI_FRONT_OFFICE_KEY, AI_FRONT_OFFICE_OFFER } from '@/lib/ghl/tags';
import { scoreQualification } from './score';
import { isLeadStage, stageForQualification } from './stages';
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
  const pit = await ghlPit();
  if (!ACQ_GHL_FORM_ID || !pit || !ACQ_GHL_LOCATION_ID) return;

  const response = await fetch(`${GHL_API}/forms/${ACQ_GHL_FORM_ID}/submissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pit}`,
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
      redirectTo:
        input.offerKey === AI_FRONT_OFFICE_KEY
          ? frontOfficeNotYetPath(host)
          : input.niche === 'roofing'
            ? roofingNotYetPath(host)
            : redirectTo(host),
    };
  }

  let payload: QualificationPayload;
  try {
    if (input.offerKey === AI_FRONT_OFFICE_KEY) {
      payload = await withFrontOfficeTouch(parseFrontOfficeLead(input));
    } else {
      payload = input.niche === 'roofing' ? parseRoofingLead(input) : parseQualification(input);
    }
    payload.consentPageUrl = meta?.eventSourceUrl;
  } catch (error) {
    if (error instanceof QualificationError) {
      return { ok: false, error: error.message, field: error.field };
    }
    return { ok: false, error: 'Check the form and try again.' };
  }

  const score = scoreQualification(payload);
  payload.stage = stageForQualification(score.qualificationResult);

  let contactId = '';
  if (await ghlReady()) {
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

  let leadId = '';
  let scheduleToken = '';
  let airtableRecordId: string | null = null;
  try {
    const lead = await upsertLeadFromQualification(payload, contactId);
    leadId = lead.id;
    scheduleToken = lead.schedule_token;
    airtableRecordId = lead.airtable_record_id;
    if (isLeadStage(lead.stage)) payload.stage = lead.stage;
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

  await moveGhlLead({
    contactId,
    stage: payload.stage,
    name: payload.companyName ? `${payload.fullName} - ${payload.companyName}` : payload.fullName,
    fields: { workspaceLeadId: leadId, airtableRecordId: writtenAirtableId },
  });

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

  if (process.env.VITEST !== 'true' && schedulePath) {
    const recorded = await recordBookingEvent({
      type: 'application',
      email: payload.email,
      phone: payload.phone,
      fullName: payload.fullName,
      firstName: payload.firstName,
      smsConsent: payload.smsConsent,
      smsConsentAt: payload.smsConsent ? new Date().toISOString() : null,
      smsConsentWordingVersion: payload.smsConsent ? ACQ_SMS_CONSENT_VERSION : null,
      smsConsentPageUrl: payload.consentPageUrl,
      ghlContactId: contactId || undefined,
      airtableRecordId: writtenAirtableId || undefined,
      daLeadId: leadId || undefined,
      bookingLink: `${ACQ_PUBLIC_ORIGIN}${schedulePath}`,
    });
    if (!recorded.ok) {
      await logPipelineFailure('booking-message', payload.email, new Error(recorded.error));
    }
  }

  if (payload.coachingNiche === AI_FRONT_OFFICE_OFFER) {
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
        content_name: AI_FRONT_OFFICE_OFFER,
        content_category: 'local-service',
        status: payload.nicheQualified ? 'qualified' : 'unqualified',
      },
    });
    return {
      ok: true,
      redirectTo: frontOfficeVisitorPath(
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
