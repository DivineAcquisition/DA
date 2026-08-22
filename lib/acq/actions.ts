'use server';

import {
  ACQ_GHL_FORM_ID,
  ACQ_GHL_LOCATION_ID,
  ACQ_GHL_WEBHOOK_URL,
  GHL_PIT_TOKEN,
  qualificationThankYouPath,
} from './config';
import {
  ghlContactNote,
  ghlWebhookBody,
  isHoneypot,
  parseQualification,
  QualificationError,
  type QualificationInput,
  type QualificationPayload,
} from './qualify';

const GHL_API = 'https://services.leadconnectorhq.com';

export type QualifyResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; field?: string };

function redirectTo(host?: string): string {
  return qualificationThankYouPath(host);
}

async function postWebhook(payload: QualificationPayload): Promise<boolean> {
  if (!ACQ_GHL_WEBHOOK_URL) return false;

  const response = await fetch(ACQ_GHL_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(ghlWebhookBody(payload)),
    cache: 'no-store',
  });

  if (!response.ok) {
    console.error('ACQ GHL webhook failed', response.status, await response.text());
    return false;
  }
  return true;
}

async function postForm(payload: QualificationPayload): Promise<boolean> {
  if (!ACQ_GHL_FORM_ID || !GHL_PIT_TOKEN || !ACQ_GHL_LOCATION_ID) return false;

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
    return false;
  }
  return true;
}

async function upsertContact(payload: QualificationPayload): Promise<boolean> {
  if (!GHL_PIT_TOKEN || !ACQ_GHL_LOCATION_ID) return false;

  const body: Record<string, unknown> = {
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName || undefined,
    name: payload.fullName,
    phone: payload.phone,
    companyName: payload.companyName,
    locationId: ACQ_GHL_LOCATION_ID,
    source: payload.source,
    tags: payload.tags,
    customFields: [
      { key: 'monthly_ad_spend', field_value: payload.monthlyAdSpend },
      { key: 'follow_up_owner', field_value: payload.followUpOwner },
      { key: 'program_price', field_value: payload.programPrice },
      { key: 'coaching_niche', field_value: payload.coachingNiche },
    ],
  };

  const note = ghlContactNote(payload);

  try {
    const response = await fetch(`${GHL_API}/contacts/upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GHL_PIT_TOKEN}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ...body, notes: note }),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('ACQ GHL contact upsert failed', response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('ACQ GHL contact upsert error', error);
    return false;
  }
}

function pipelineConfigured(): boolean {
  return Boolean(ACQ_GHL_WEBHOOK_URL || (GHL_PIT_TOKEN && ACQ_GHL_LOCATION_ID));
}

export async function submitQualification(
  input: QualificationInput,
  host?: string,
): Promise<QualifyResult> {
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

  if (!pipelineConfigured()) {
    console.error('ACQ qualification pipeline is not configured');
    return {
      ok: false,
      error: 'Applications are paused for a moment. Try again shortly.',
    };
  }

  const results = await Promise.allSettled([postWebhook(payload), postForm(payload), upsertContact(payload)]);
  const delivered = results.some((result) => result.status === 'fulfilled' && result.value);

  if (!delivered) {
    return {
      ok: false,
      error: 'We could not submit that just now. Try again in a moment.',
    };
  }

  return { ok: true, redirectTo: redirectTo(host) };
}
