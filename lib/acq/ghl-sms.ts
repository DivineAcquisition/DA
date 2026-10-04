import { ACQ_GHL_CALENDAR_ID, ACQ_GHL_LOCATION_ID, GHL_PIT_TOKEN } from './config';

const GHL_API = 'https://services.leadconnectorhq.com';

function headers(version: string): HeadersInit {
  return {
    Authorization: `Bearer ${GHL_PIT_TOKEN}`,
    Version: version,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export async function updateGhlContactPhone(contactId: string, phone: string): Promise<void> {
  if (!GHL_PIT_TOKEN || !contactId) {
    throw new Error('GHL contact phone update is not configured');
  }
  const response = await fetch(`${GHL_API}/contacts/${contactId}`, {
    method: 'PUT',
    headers: headers('2021-07-28'),
    body: JSON.stringify({ phone }),
  });
  if (!response.ok) {
    throw new Error(`ghl_contact_phone_failed: ${response.status} ${await response.text()}`);
  }
}

export async function createAcqGhlAppointment(input: {
  contactId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetUrl?: string | null;
}): Promise<string> {
  if (!GHL_PIT_TOKEN || !ACQ_GHL_LOCATION_ID || !ACQ_GHL_CALENDAR_ID) {
    throw new Error('ACQ GHL calendar is not configured');
  }
  if (!input.contactId) throw new Error('GHL contact id is required');

  const body: Record<string, unknown> = {
    calendarId: ACQ_GHL_CALENDAR_ID,
    locationId: ACQ_GHL_LOCATION_ID,
    contactId: input.contactId,
    startTime: input.startsAt,
    endTime: input.endsAt,
    title: input.title,
    appointmentStatus: 'confirmed',
    ignoreDateRange: true,
    ignoreFreeSlotValidation: true,
    toNotify: false,
  };
  if (input.meetUrl) {
    body.address = input.meetUrl;
    body.meetingLocationType = 'custom';
    body.meetingLocationId = 'custom_0id';
    body.overrideLocationConfig = true;
    body.description = `Google Meet: ${input.meetUrl}`;
  }

  const response = await fetch(`${GHL_API}/calendars/events/appointments`, {
    method: 'POST',
    headers: headers('2021-04-15'),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`ghl_appointment_failed: ${response.status} ${await response.text()}`);
  }
  const payload = (await response.json()) as {
    id?: string;
    appointment?: { id?: string };
  };
  const id = payload.id ?? payload.appointment?.id;
  if (!id) throw new Error('ghl_appointment_failed: response missing appointment id');
  return id;
}

export async function sendGhlSms(contactId: string, message: string): Promise<void> {
  if (!GHL_PIT_TOKEN || !contactId) {
    throw new Error('GHL SMS is not configured');
  }
  const response = await fetch(`${GHL_API}/conversations/messages`, {
    method: 'POST',
    headers: headers('2021-04-15'),
    body: JSON.stringify({
      type: 'SMS',
      contactId,
      message,
    }),
  });
  if (!response.ok) {
    throw new Error(`ghl_sms_failed: ${response.status} ${await response.text()}`);
  }
}
