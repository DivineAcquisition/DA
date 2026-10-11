import type { EventType, NormalizedEvent } from './types';

const TYPES: Record<string, EventType> = {
  booked: 'booked',
  booking: 'booked',
  created: 'booked',
  appointmentcreate: 'booked',
  'appointment.created': 'booked',
  rescheduled: 'rescheduled',
  reschedule: 'rescheduled',
  updated: 'rescheduled',
  appointmentupdate: 'rescheduled',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  appointmentdelete: 'cancelled',
  held: 'held',
  attended: 'held',
  showed: 'held',
  'no-show': 'no_show',
  noshow: 'no_show',
  no_show: 'no_show',
  application: 'application',
  inbound: 'inbound',
  inboundmessage: 'inbound',
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function eventType(value: string): EventType | null {
  const key = value.trim().toLowerCase().replace(/[\s_]+/g, '');
  return TYPES[key] ?? TYPES[value.trim().toLowerCase()] ?? null;
}

/**
 * Turns a normalized body, or the loose appointment shape a calendar webhook
 * usually posts, into one event. The queue never imports a calendar SDK.
 */
export function adaptPayload(body: unknown): { ok: true; event: NormalizedEvent } | { ok: false; error: string } {
  const root = object(body);
  const appointment = object(root.appointment ?? root.calendar ?? root.event);
  const contact = object(root.contact ?? root.lead);
  const typeValue = text(root.type ?? root.eventType ?? root.status ?? appointment.status ?? appointment.appointmentStatus);
  const type = eventType(typeValue);
  if (!type) return { ok: false, error: 'unrecognized booking event' };

  const email = text(root.email ?? root.leadEmail ?? contact.email);
  const phone = text(root.phone ?? root.leadPhone ?? contact.phone);
  const startsAt = text(root.startsAt ?? root.startTime ?? appointment.startTime ?? appointment.start);
  const endsAt = text(root.endsAt ?? root.endTime ?? appointment.endTime ?? appointment.end);
  const bookingId = text(root.bookingId ?? root.booking_id ?? root.id ?? appointment.id);
  const meetingLink = text(root.meetingLink ?? root.meeting_link ?? appointment.address ?? appointment.meetingLink);
  const fullName = text(root.fullName ?? root.full_name ?? contact.name ?? contact.fullName);
  const firstName = text(root.firstName ?? root.first_name ?? contact.firstName);

  if (type !== 'inbound' && type !== 'application' && type !== 'cancelled' && type !== 'held' && !startsAt && !bookingId) {
    return { ok: false, error: 'booking event is missing a time and an id' };
  }

  return {
    ok: true,
    event: {
      eventId: text(root.eventId ?? root.event_id) || undefined,
      type,
      email: email || undefined,
      phone: phone || undefined,
      firstName: firstName || undefined,
      fullName: fullName || undefined,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      timeZone: text(root.timeZone ?? root.time_zone) || undefined,
      bookingId: bookingId || undefined,
      meetingLink: meetingLink || undefined,
      rescheduleLink: text(root.rescheduleLink ?? root.reschedule_link) || undefined,
      bookingLink: text(root.bookingLink ?? root.booking_link) || undefined,
      smsConsent: typeof root.smsConsent === 'boolean' ? root.smsConsent : undefined,
      ghlContactId: text(root.ghlContactId ?? root.contactId ?? contact.id) || undefined,
      airtableRecordId: text(root.airtableRecordId) || undefined,
      daLeadId: text(root.daLeadId) || undefined,
      body: text(root.body ?? root.message) || undefined,
    },
  };
}
