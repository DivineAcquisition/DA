import { GHL_LOCATION_ID, GHL_PIT_TOKEN } from './config';

type GhlContactResult = { contactId: string | null };

/**
 * Upserts a contact into the GHL subaccount for the talent acquisition pipeline.
 * Failures are non-fatal — the booking invite still sends.
 */
export async function upsertTalentContact(input: {
  email: string;
  fullName: string;
  companyName?: string | null;
  note?: string | null;
}): Promise<GhlContactResult> {
  if (!GHL_PIT_TOKEN) return { contactId: null };

  const parts = input.fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ') || undefined;

  const body: Record<string, unknown> = {
    email: input.email,
    firstName,
    lastName,
    name: input.fullName,
    source: 'Assessment Invite',
    tags: ['assessment-invite', 'talent-pipeline'],
  };

  if (GHL_LOCATION_ID) body.locationId = GHL_LOCATION_ID;
  if (input.companyName) body.companyName = input.companyName;
  if (input.note) {
    body.customFields = [{ key: 'assessment_note', field_value: input.note }];
  }

  try {
    const response = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GHL_PIT_TOKEN}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('GHL contact upsert failed', response.status, await response.text());
      return { contactId: null };
    }

    const payload = (await response.json()) as {
      contact?: { id?: string };
      id?: string;
    };

    return { contactId: payload.contact?.id ?? payload.id ?? null };
  } catch (error) {
    console.error('GHL contact upsert error', error);
    return { contactId: null };
  }
}
