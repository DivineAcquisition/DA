import {
  ACQ_GHL_FORM_ID,
  ACQ_GHL_LOCATION_ID,
  ACQ_GHL_WEBHOOK_URL,
  GHL_PIT_TOKEN,
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
import { scoreQualification } from './score';
import {
  ghlWebhookBody,
  isHoneypot,
  parseQualification,
  QualificationError,
  type QualificationInput,
  type QualificationPayload,
} from './qualify';

export type QualifyResult =
  | { ok: true; redirectTo: string }
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
 * Qualification pipeline. Step 1 (GHL contact) is required. The workspace
 * stores the lead next. Airtable is a send destination — missing PAT does
 * not block thank-you. Score is computed in-app, not read from Airtable.
 */
export async function submitLead(input: QualificationInput, host?: string): Promise<QualifyResult> {
  if (isHoneypot(input)) {
    return { ok: true, redirectTo: redirectTo(host) };
  }

  let payload: QualificationPayload;
  try {
    payload = parseQualification(input);
  } catch (error) {
    if (error instanceof QualificationError) {
      return { ok: false, error: error.message, field: error.field };
    }
    return { ok: false, error: 'Check the form and try again.' };
  }

  if (!ghlConfigured()) {
    console.error('ACQ qualification pipeline is not configured');
    return {
      ok: false,
      error: 'Applications are paused for a moment. Try again shortly.',
    };
  }

  let contactId: string;
  try {
    const contact = await upsertGhlContact(payload);
    contactId = contact.contactId;
  } catch (error) {
    await logPipelineFailure('ghl-contact', payload.email, error);
    return {
      ok: false,
      error: 'We could not submit that just now. Try again in a moment.',
    };
  }

  void postWebhook(payload).catch((error) => {
    console.error('[acq:ghl-webhook]', error);
  });
  void postForm(payload).catch((error) => {
    console.error('[acq:ghl-form]', error);
  });

  const score = scoreQualification(payload);

  let leadId = '';
  let airtableRecordId: string | null = null;
  try {
    const lead = await upsertLeadFromQualification(payload, contactId);
    leadId = lead.id;
    airtableRecordId = lead.airtable_record_id;
  } catch (error) {
    await logPipelineFailure('workspace-lead', payload.email, error);
  }

  try {
    await writeScoreToGhl(contactId, {
      recordId: leadId || contactId,
      readinessScore: score.readinessScore,
      qualificationResult: score.qualificationResult,
    });
  } catch (error) {
    await logPipelineFailure('ghl-score', payload.email, error);
  }

  try {
    const sent = await upsertAirtableLead(payload, contactId, airtableRecordId);
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

  return { ok: true, redirectTo: redirectTo(host) };
}
