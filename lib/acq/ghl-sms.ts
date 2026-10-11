import { redact } from '@/lib/ghl/rules';
import {
  ACQ_GHL_CALENDAR_ID,
  ACQ_GHL_LOCATION_ID,
  FREE_SALES_OPS_AUDIT_CALENDAR_NAME,
} from './config';
import { ghlPit, ghlPitSync } from '@/lib/ghl/pit';

const GHL_API = 'https://services.leadconnectorhq.com';

async function headers(version: string): Promise<HeadersInit> {
  return {
    Authorization: `Bearer ${await ghlPit()}`,
    Version: version,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export async function updateGhlContactPhone(contactId: string, phone: string): Promise<void> {
  if (!(await ghlPit()) || !contactId) {
    throw new Error('GHL contact phone update is not configured');
  }
  const response = await fetch(`${GHL_API}/contacts/${contactId}`, {
    method: 'PUT',
    headers: await headers('2021-07-28'),
    body: JSON.stringify({ phone }),
  });
  if (!response.ok) {
    throw safeGhlError('ghl_contact_phone_failed', response.status, await response.text());
  }
}

export async function salesOpsCalendarReady(): Promise<boolean> {
  return Boolean((await ghlPit()) && ACQ_GHL_LOCATION_ID && ACQ_GHL_CALENDAR_ID);
}

export type GhlAppointmentInput = {
  contactId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetUrl?: string | null;
  notes?: string | null;
};

/** Appointment body for the Free Sales Ops Audit | DivineACQ™ calendar. */
export function salesOpsAppointmentBody(input: GhlAppointmentInput): Record<string, unknown> {
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
  if (input.notes) body.notes = input.notes;
  if (input.meetUrl) {
    body.address = input.meetUrl;
    body.meetingLocationType = 'custom';
    body.meetingLocationId = 'custom_0id';
    body.overrideLocationConfig = true;
    body.description = `Google Meet: ${input.meetUrl}`;
  }
  return body;
}

export function meetingLinkFromAppointment(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = payload as Record<string, unknown>;
  const nested = row.appointment && typeof row.appointment === 'object' ? (row.appointment as Record<string, unknown>) : {};
  const candidates = [row.address, nested.address, row.meetingLocation, nested.meetingLocation];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().toLowerCase().startsWith('https://')) return value.trim();
  }
  return null;
}

function appointmentIdFrom(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = payload as Record<string, unknown>;
  const nested = row.appointment && typeof row.appointment === 'object' ? (row.appointment as Record<string, unknown>) : {};
  const id = row.id ?? nested.id;
  return typeof id === 'string' && id ? id : null;
}

function safeGhlError(prefix: string, status: number, body: string): Error {
  return new Error(redact(`${prefix}: ${status} ${body}`, [ghlPitSync()]));
}

export async function createSalesOpsAppointment(
  input: GhlAppointmentInput,
): Promise<{ id: string; meetingLink: string | null; calendarName: string }> {
  if (!(await salesOpsCalendarReady())) throw new Error('ACQ GHL calendar is not configured');
  if (!input.contactId) throw new Error('GHL contact id is required');

  const response = await fetch(`${GHL_API}/calendars/events/appointments`, {
    method: 'POST',
    headers: await headers('2021-04-15'),
    body: JSON.stringify(salesOpsAppointmentBody(input)),
  });
  const text = await response.text();
  if (!response.ok) throw safeGhlError('ghl_appointment_failed', response.status, text);
  const payload = text ? JSON.parse(text) : {};
  const id = appointmentIdFrom(payload);
  if (!id) throw new Error('ghl_appointment_failed: response missing appointment id');
  return { id, meetingLink: meetingLinkFromAppointment(payload), calendarName: FREE_SALES_OPS_AUDIT_CALENDAR_NAME };
}

export async function cancelSalesOpsAppointment(appointmentId: string): Promise<void> {
  if (!(await ghlPit()) || !appointmentId) return;
  const response = await fetch(`${GHL_API}/calendars/events/appointments/${encodeURIComponent(appointmentId)}`, {
    method: 'PUT',
    headers: await headers('2021-04-15'),
    body: JSON.stringify({ appointmentStatus: 'cancelled' }),
  });
  if (!response.ok && response.status !== 404) {
    console.error('[ghl] appointment cancel failed', response.status);
  }
}

export async function createAcqGhlAppointment(input: GhlAppointmentInput): Promise<string> {
  const created = await createSalesOpsAppointment(input);
  return created.id;
}

export async function sendGhlSms(contactId: string, message: string): Promise<void> {
  if (!(await ghlPit()) || !contactId) {
    throw new Error('GHL SMS is not configured');
  }
  const response = await fetch(`${GHL_API}/conversations/messages`, {
    method: 'POST',
    headers: await headers('2021-04-15'),
    body: JSON.stringify({
      type: 'SMS',
      contactId,
      message,
    }),
  });
  if (!response.ok) {
    throw safeGhlError('ghl_sms_failed', response.status, await response.text());
  }
}
