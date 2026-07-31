import { GHL_CALENDAR_ID, GHL_LOCATION_ID, GHL_PIT_TOKEN } from './config';

const GHL_API = 'https://services.leadconnectorhq.com';

function ghlHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${GHL_PIT_TOKEN}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

type GhlContactResult = { contactId: string | null };

/**
 * Upserts a contact into the GHL subaccount for the talent acquisition pipeline.
 */
export async function upsertTalentContact(input: {
  email: string;
  fullName: string;
  companyName?: string | null;
  note?: string | null;
  source?: string;
  tags?: string[];
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
    locationId: GHL_LOCATION_ID,
    source: input.source ?? 'Assessment Invite',
    tags: input.tags ?? ['assessment-invite', 'talent-pipeline'],
  };

  if (input.companyName) body.companyName = input.companyName;
  if (input.note) {
    body.customFields = [{ key: 'assessment_note', field_value: input.note }];
  }

  try {
    const response = await fetch(`${GHL_API}/contacts/upsert`, {
      method: 'POST',
      headers: ghlHeaders(),
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

export type CreatedGhlAppointment = {
  appointmentId: string;
  contactId: string;
  calendarId: string;
  status: string | null;
};

/**
 * Creates a confirmed appointment on the Assessment Interview calendar via PIT.
 * Uses ignoreFreeSlotValidation so admin-picked slots still book outside open hours.
 */
export async function createTalentAppointment(input: {
  contactId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetUrl?: string | null;
  notes?: string | null;
  toNotify?: boolean;
}): Promise<CreatedGhlAppointment> {
  if (!GHL_PIT_TOKEN) {
    throw new Error('GHL_PIT_TOKEN is not configured');
  }
  if (!input.contactId) {
    throw new Error('GHL contact id is required to create an appointment');
  }

  const body: Record<string, unknown> = {
    calendarId: GHL_CALENDAR_ID,
    locationId: GHL_LOCATION_ID,
    contactId: input.contactId,
    startTime: input.startsAt,
    endTime: input.endsAt,
    title: input.title,
    appointmentStatus: 'confirmed',
    ignoreDateRange: true,
    ignoreFreeSlotValidation: true,
    toNotify: input.toNotify ?? false,
  };

  if (input.meetUrl) {
    body.address = input.meetUrl;
    body.meetingLocationType = 'custom';
    body.meetingLocationId = 'custom_0id';
    body.overrideLocationConfig = true;
    body.description = `Google Meet: ${input.meetUrl}`;
  }
  if (input.notes) body.notes = input.notes;

  const response = await fetch(`${GHL_API}/calendars/events/appointments`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`ghl_appointment_failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    id?: string;
    appointment?: { id?: string; appointmentStatus?: string; status?: string };
    appointmentStatus?: string;
    status?: string;
  };

  const appointmentId = payload.id ?? payload.appointment?.id;
  if (!appointmentId) {
    throw new Error('ghl_appointment_failed: response missing appointment id');
  }

  return {
    appointmentId,
    contactId: input.contactId,
    calendarId: GHL_CALENDAR_ID,
    status:
      payload.appointmentStatus ??
      payload.appointment?.appointmentStatus ??
      payload.status ??
      payload.appointment?.status ??
      null,
  };
}

/**
 * Upsert contact + create GHL appointment for an admin-scheduled assessment.
 * Throws when the PIT booking cannot be completed — callers should treat GHL as required.
 */
export async function bookAssessmentInGhl(input: {
  email: string;
  fullName: string;
  companyName?: string | null;
  note?: string | null;
  startsAt: string;
  endsAt: string;
  meetUrl?: string | null;
}): Promise<{ contactId: string; appointmentId: string }> {
  if (!GHL_PIT_TOKEN) {
    throw new Error('GHL_PIT_TOKEN is not configured');
  }

  const { contactId } = await upsertTalentContact({
    email: input.email,
    fullName: input.fullName,
    companyName: input.companyName,
    note: input.note,
    source: 'Assessment Booking',
    tags: ['assessment-booking', 'talent-pipeline'],
  });

  if (!contactId) {
    throw new Error('GHL contact upsert failed via PIT');
  }

  const title = input.companyName
    ? `Assessment Interview — ${input.fullName} (${input.companyName})`
    : `Assessment Interview — ${input.fullName}`;

  const appointment = await createTalentAppointment({
    contactId,
    title,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    meetUrl: input.meetUrl,
    notes: [
      'Booked from Divine Acquisition admin via PIT',
      input.note ? `Notes: ${input.note}` : null,
      input.meetUrl ? `Meet: ${input.meetUrl}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    toNotify: false,
  });

  return { contactId, appointmentId: appointment.appointmentId };
}
