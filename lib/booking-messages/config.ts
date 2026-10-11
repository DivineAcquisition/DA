import type { MessageType } from './types';

/**
 * GoHighLevel Private Integration Token scopes this sender needs.
 * Location token, nothing broader.
 *
 * - contacts.readonly — read the contact, tags, and Do Not Disturb at send time
 * - contacts.write — create a missing contact with the same fields the landing
 *   page uses, add `consent - do not contact` when someone replies STOP, and
 *   swap the `lead - ...` and `appointment - ...` tags as a booking changes
 * - conversations.readonly — read the conversation the message lands in
 * - conversations/message.readonly — read an inbound reply so STOP can be seen
 * - conversations/message.write — send the email or the text
 * - opportunities.readonly — find the lead pipeline and the contact's opportunity
 * - opportunities.write — create the opportunity and move it between stages
 *
 * contacts.write is the extra scope beyond "read contacts". Without it a
 * missing contact cannot be created and STOP cannot be tagged.
 */
export const GHL_BOOKING_SCOPES = [
  'contacts.readonly',
  'contacts.write',
  'conversations.readonly',
  'conversations/message.readonly',
  'conversations/message.write',
  'opportunities.readonly',
  'opportunities.write',
] as const;

export type SendMode = 'live' | 'test' | 'dry-run';

export type BookingMessageConfig = {
  mode: SendMode;
  texting: boolean;
  emailing: boolean;
  testContactId: string;
  pit: string;
  locationId: string;
  fromName: string;
  fromEmail: string;
  schedulerSecret: string;
  webhookSecret: string;
  maxAttempts: number;
  retryMinutes: number[];
  batchSize: number;
  staleMinutes: Record<MessageType, number>;
  bookingLink: string;
  rescheduleLink: string;
};

const STALE_DEFAULTS: Record<MessageType, number> = {
  application_received: 180,
  booking_confirmation: 12 * 60,
  reminder_24h: 6 * 60,
  reminder_2h: 60,
  reminder_15m: 30,
  no_show_text: 30,
  no_show_email: 3 * 60,
  reschedule_confirmation: 12 * 60,
  cancellation: 24 * 60,
};

const STALE_ENV: Record<MessageType, string> = {
  application_received: 'BOOKING_STALE_APPLICATION_MINUTES',
  booking_confirmation: 'BOOKING_STALE_CONFIRMATION_MINUTES',
  reminder_24h: 'BOOKING_STALE_REMINDER_24H_MINUTES',
  reminder_2h: 'BOOKING_STALE_REMINDER_2H_MINUTES',
  reminder_15m: 'BOOKING_STALE_REMINDER_15M_MINUTES',
  no_show_text: 'BOOKING_STALE_NO_SHOW_TEXT_MINUTES',
  no_show_email: 'BOOKING_STALE_NO_SHOW_EMAIL_MINUTES',
  reschedule_confirmation: 'BOOKING_STALE_RESCHEDULE_MINUTES',
  cancellation: 'BOOKING_STALE_CANCELLATION_MINUTES',
};

type Env = Record<string, string | undefined>;

function read(env: Env, name: string): string {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function flag(value: string, fallback: boolean): boolean {
  if (!value) return fallback;
  if (value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'on') return true;
  if (value === '0' || value.toLowerCase() === 'false' || value.toLowerCase() === 'off') return false;
  return fallback;
}

function positiveInt(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function modeOf(value: string): SendMode {
  if (value === 'live' || value === 'test' || value === 'dry-run') return value;
  return 'dry-run';
}

export function readBookingMessageConfig(env: Env = process.env): BookingMessageConfig {
  const staleMinutes = { ...STALE_DEFAULTS };
  for (const type of Object.keys(STALE_ENV) as MessageType[]) {
    const override = read(env, STALE_ENV[type]);
    if (override) staleMinutes[type] = positiveInt(override, STALE_DEFAULTS[type]);
  }

  const retry = read(env, 'BOOKING_MESSAGE_RETRY_MINUTES');
  const retryMinutes = retry
    ? retry
        .split(',')
        .map((part) => positiveInt(part.trim(), 0))
        .filter((part) => part > 0)
    : [2, 10, 30];

  const bookingLink = read(env, 'BOOKING_LINK') || 'https://acq.divineacquisition.io/book';
  const rescheduleLink = read(env, 'BOOKING_RESCHEDULE_URL') || bookingLink;

  return {
    mode: modeOf(read(env, 'BOOKING_MESSAGE_MODE')),
    // Off until carrier registration (A2P 10DLC) is confirmed.
    texting: flag(read(env, 'BOOKING_TEXTING_ENABLED'), false),
    emailing: flag(read(env, 'BOOKING_EMAILING_ENABLED'), true),
    testContactId: read(env, 'BOOKING_TEST_CONTACT_ID'),
    pit: read(env, 'BOOKING_GHL_PIT') || read(env, 'GHL_PIT_TOKEN') || read(env, 'GHL_PIT_KEY'),
    locationId:
      read(env, 'BOOKING_GHL_LOCATION_ID') ||
      read(env, 'ACQ_GHL_LOCATION_ID') ||
      read(env, 'GHL_LOCATION_ID'),
    fromName: read(env, 'BOOKING_FROM_NAME') || 'Malik at Divine Acquisition',
    fromEmail: read(env, 'BOOKING_FROM_EMAIL'),
    schedulerSecret: read(env, 'BOOKING_SCHEDULER_SECRET') || read(env, 'CRON_SECRET'),
    webhookSecret: read(env, 'BOOKING_WEBHOOK_SECRET'),
    maxAttempts: positiveInt(read(env, 'BOOKING_MESSAGE_MAX_ATTEMPTS'), 3),
    retryMinutes: retryMinutes.length ? retryMinutes : [2, 10, 30],
    batchSize: positiveInt(read(env, 'BOOKING_MESSAGE_BATCH'), 15),
    staleMinutes,
    bookingLink,
    rescheduleLink,
  };
}

/** Live and test are the modes that actually deliver. Dry-run only logs. */
export function bookingMessagesOwnDelivery(env: Env = process.env): boolean {
  const mode = readBookingMessageConfig(env).mode;
  return mode === 'live' || mode === 'test';
}

export function textingEnabled(env: Env = process.env): boolean {
  return readBookingMessageConfig(env).texting;
}
