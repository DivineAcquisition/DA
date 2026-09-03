import { httpUrlOrEmpty } from './map';
import type { ProspectCallKind, ProspectCallSource } from './types';

export type InboundCall = {
  kind: ProspectCallKind;
  source: ProspectCallSource;
  externalRef: string;
  email: string;
  fullName: string;
  occurredAt: string | null;
  meetUrl: string;
  recordingUrl: string;
  transcript: string;
  googleEventId: string;
  ghlContactId: string;
  payload: Record<string, unknown>;
};

export type ParseInboundResult =
  | { ok: true; call: InboundCall }
  | { ok: false; reason: 'ignored' | 'invalid'; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function dig(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const part of path.split('.')) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[part];
  }
  return current;
}

function firstText(root: unknown, paths: string[]): string {
  for (const path of paths) {
    const value = dig(root, path);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function eventLabel(root: unknown): string {
  return firstText(root, ['type', 'event', 'event_type', 'eventType', 'triggerName']).toLowerCase();
}

const IGNORED = /^(contactcreate|contactdelete|inboundmessage|outboundmessage|opportunity|payment|invoice)/i;

function looksLikeAppointment(root: unknown, label: string): boolean {
  if (/appointment|booking|invitee|calendar/.test(label)) return true;
  return Boolean(
    firstText(root, [
      'appointment.id',
      'appointmentId',
      'calendar.appointmentId',
      'payload.id',
      'invitee.email',
    ]),
  );
}

/**
 * Turns a GHL / iClosed / calendar webhook body into a prospect-call row.
 * Contact-only events are ignored — those are not call data.
 */
export function parseInboundCall(payload: unknown): ParseInboundResult {
  const root = asRecord(payload);
  if (!root) return { ok: false, reason: 'invalid', error: 'Body was not a JSON object.' };

  const nested = asRecord(root.appointment) ?? asRecord(root.payload) ?? asRecord(root.data) ?? {};
  const search: unknown = { ...root, appointment: nested, payload: nested };

  const label = eventLabel(root);
  if (label && IGNORED.test(label) && !looksLikeAppointment(search, label)) {
    return { ok: false, reason: 'ignored', error: `Not a call event (${label}).` };
  }
  if (label && !looksLikeAppointment(search, label) && !firstText(search, ['appointment.startTime', 'startTime'])) {
    return { ok: false, reason: 'ignored', error: `Not a call event (${label || 'unknown'}).` };
  }

  const email = firstText(search, [
    'contact.email',
    'email',
    'payload.email',
    'invitee.email',
    'invitee_email',
    'customer.email',
  ]).toLowerCase();

  const fullName = firstText(search, [
    'contact.name',
    'contact.fullName',
    'full_name',
    'fullName',
    'name',
    'payload.name',
    'invitee.name',
    'customer.name',
  ]);

  const occurredAt =
    firstText(search, [
      'appointment.startTime',
      'appointment.start_time',
      'startTime',
      'start_time',
      'calendar.startTime',
      'payload.start_time',
      'event_start',
      'starts_at',
    ]) || null;

  const meetRaw = firstText(search, [
    'appointment.address',
    'appointment.meetingLocation',
    'appointment.googleMeetUrl',
    'appointment.meetUrl',
    'calendar.address',
    'meet_url',
    'meetUrl',
    'google_meet_url',
    'meet_link',
    'payload.location',
    'location',
  ]);
  const meetUrl = httpUrlOrEmpty(meetRaw);

  const recordingRaw = firstText(search, [
    'recording_url',
    'recordingUrl',
    'recording.link',
    'appointment.recordingUrl',
  ]);
  const recordingUrl = httpUrlOrEmpty(recordingRaw);

  const transcript = firstText(search, ['transcript', 'appointment.transcript']);
  const externalRef = firstText(search, [
    'appointment.id',
    'appointmentId',
    'calendar.appointmentId',
    'payload.id',
    'id',
  ]);
  const googleEventId = firstText(search, [
    'google_event_id',
    'googleEventId',
    'appointment.googleEventId',
    'eventId',
  ]);
  const ghlContactId = firstText(search, [
    'contact.id',
    'contactId',
    'appointment.contactId',
    'ghl_contact_id',
  ]);

  if (!email && !externalRef && !meetUrl) {
    return { ok: false, reason: 'invalid', error: 'Call payload needs an email, appointment id, or Meet URL.' };
  }

  const source: ProspectCallSource = /iclosed|calendar/.test(label) ? 'calendar' : 'ghl';
  // Appointments stay bookings even when a recording later appears on the same
  // payload — that recording is forwarded with the Meet URL onto the lead, not
  // treated as a debrief/touch artifact (those need an Airtable rec id).
  const appointment = looksLikeAppointment(search, label) || Boolean(occurredAt);
  const kind: ProspectCallKind = appointment ? 'booking' : recordingUrl || transcript ? 'artifact' : 'booking';

  return {
    ok: true,
    call: {
      kind,
      source,
      externalRef,
      email,
      fullName,
      occurredAt,
      meetUrl,
      recordingUrl,
      transcript,
      googleEventId,
      ghlContactId,
      payload: root,
    },
  };
}

export function inboundRecordInput(call: InboundCall, airtableLeadId?: string) {
  return {
    kind: call.kind,
    source: call.source,
    airtableLeadId: airtableLeadId || undefined,
    email: call.email || undefined,
    fullName: call.fullName || undefined,
    externalRef: call.externalRef || undefined,
    occurredAt: call.occurredAt || undefined,
    meetUrl: call.meetUrl || undefined,
    recordingUrl: call.recordingUrl || undefined,
    transcript: call.transcript || undefined,
    googleEventId: call.googleEventId || undefined,
    payload: {
      ...call.payload,
      ghl_contact_id: call.ghlContactId || undefined,
    },
  };
}
