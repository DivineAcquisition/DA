/** Booking messages. Statuses and types are the whole vocabulary the queue uses. */

export const MESSAGE_TYPES = [
  'application_received',
  'booking_confirmation',
  'reminder_24h',
  'reminder_2h',
  'reminder_15m',
  'no_show_text',
  'no_show_email',
  'reschedule_confirmation',
  'cancellation',
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export type Channel = 'email' | 'sms';

export type MessageStatus = 'pending' | 'sent' | 'skipped' | 'failed' | 'cancelled';

export type BookingStatus = 'booked' | 'rescheduled' | 'cancelled' | 'held' | 'no_show';

export type EventType = BookingStatus | 'application' | 'inbound';

export type Person = {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  fullName: string;
  timeZone: string;
  timeZoneSource: 'given' | 'area_code' | 'eastern';
  smsConsent: boolean;
  smsConsentAt: string | null;
  smsConsentWordingVersion: string | null;
  smsConsentPageUrl: string | null;
  ghlContactId: string;
  airtableRecordId: string;
  daLeadId: string;
  doNotContact: boolean;
  unmatched: boolean;
};

export type Booking = {
  id: string;
  externalId: string;
  personId: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  meetingLink: string;
  rescheduleLink: string;
  bookingLink: string;
  unmatched: boolean;
};

export type QueuedMessage = {
  id: string;
  personId: string;
  bookingId: string | null;
  type: MessageType;
  channel: Channel;
  scheduledFor: string;
  status: MessageStatus;
  reason: string;
  final: boolean;
  attempts: number;
  nextAttemptAt: string | null;
  ghlMessageId: string | null;
  dryRun: boolean;
  flagged: boolean;
  sentAt: string | null;
  touchError: string;
};

export type Slice = {
  people: Person[];
  bookings: Booking[];
  messages: QueuedMessage[];
  seen: string[];
};

export type NormalizedEvent = {
  /** Provider id when one exists. The same booking and time still dedupes without it. */
  eventId?: string;
  type: EventType;
  email?: string;
  phone?: string;
  firstName?: string;
  fullName?: string;
  startsAt?: string;
  endsAt?: string;
  timeZone?: string;
  bookingId?: string;
  meetingLink?: string;
  rescheduleLink?: string;
  bookingLink?: string;
  smsConsent?: boolean;
  smsConsentAt?: string | null;
  smsConsentWordingVersion?: string | null;
  smsConsentPageUrl?: string | null;
  ghlContactId?: string;
  airtableRecordId?: string;
  daLeadId?: string;
  /** Inbound reply body. STOP is the only automated reaction. */
  body?: string;
};

export type ContactSnapshot = {
  id: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  dndAll: boolean;
  dndEmail: boolean;
  dndSms: boolean;
};

export type RenderedMessage = {
  subject: string;
  body: string;
};

export type SendDecision =
  | { action: 'send'; rendered: RenderedMessage; contactId: string; dryRun: boolean }
  | { action: 'skip'; status: 'skipped' | 'cancelled'; reason: string; flagged: boolean }
  | { action: 'fail'; reason: string }
  | { action: 'hold'; scheduledFor: string; reason: string };
