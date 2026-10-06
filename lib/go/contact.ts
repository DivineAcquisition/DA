import { ACQ_GHL_LOCATION_ID, GHL_PIT_TOKEN } from '@/lib/acq/config';

const GHL_API = 'https://services.leadconnectorhq.com';
const TAG = 'Cleaning Strategy Session';

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${GHL_PIT_TOKEN}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function contactIdFrom(payload: { contact?: { id?: string }; id?: string }): string | null {
  return payload.contact?.id ?? payload.id ?? null;
}

function splitName(fullName: string): { firstName: string; lastName?: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || fullName;
  const lastName = parts.slice(1).join(' ');
  return lastName ? { firstName, lastName } : { firstName };
}

async function ghl<T>(path: string, init: RequestInit): Promise<T> {
  if (!GHL_PIT_TOKEN || !ACQ_GHL_LOCATION_ID) {
    throw new Error('GHL contact is not configured');
  }
  const response = await fetch(`${GHL_API}${path}`, { ...init, headers: headers() });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`ghl_contact_failed: ${response.status} ${text}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

async function findContact(email: string): Promise<string | null> {
  try {
    const duplicate = await ghl<{ contact?: { id?: string }; id?: string }>(
      `/contacts/search/duplicate?locationId=${encodeURIComponent(ACQ_GHL_LOCATION_ID)}&email=${encodeURIComponent(email)}`,
      { method: 'GET' },
    );
    const id = contactIdFrom(duplicate);
    if (id) return id;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('404')) throw error;
  }

  const listed = await ghl<{ contacts?: Array<{ id?: string; email?: string }> }>(
    `/contacts/?locationId=${encodeURIComponent(ACQ_GHL_LOCATION_ID)}&query=${encodeURIComponent(email)}&limit=20`,
    { method: 'GET' },
  );
  return (
    listed.contacts?.find((contact) => contact.email?.trim().toLowerCase() === email && contact.id)?.id ??
    null
  );
}

/** Contact used only so appointment texts can be sent. Not a coaches application. */
export async function upsertStrategyContact(input: {
  fullName: string;
  email: string;
  phone: string;
}): Promise<string> {
  const name = splitName(input.fullName);
  const body: Record<string, unknown> = {
    email: input.email,
    phone: input.phone,
    name: input.fullName,
    firstName: name.firstName,
    source: 'Cleaning strategy session',
  };
  if (name.lastName) body.lastName = name.lastName;

  const existingId = await findContact(input.email);
  const payload = existingId
    ? await ghl<{ contact?: { id?: string }; id?: string }>(`/contacts/${existingId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    : await ghl<{ contact?: { id?: string }; id?: string }>('/contacts/', {
        method: 'POST',
        body: JSON.stringify({ ...body, locationId: ACQ_GHL_LOCATION_ID, tags: [TAG] }),
      });
  const contactId = contactIdFrom(payload) ?? existingId;
  if (!contactId) throw new Error('ghl_contact_failed: response missing contact id');

  await ghl(`/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags: [TAG] }),
  });
  return contactId;
}
