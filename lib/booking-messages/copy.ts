import { APPOINTMENT_TAGS, TAGS } from '@/lib/ghl/tags';
import type { Channel, MessageType } from './types';

export const EMAIL_FOOTER = 'Divine Acquisition LLC, 7404 Executive Place, Lanham, MD 20706';

/** Bump when the checkbox sentence changes. The stored version is the proof. */
export const ACQ_SMS_CONSENT_VERSION = 'acq-audit-2026-10-11';
export const GO_SMS_CONSENT_VERSION = 'go-strategy-2026-10-11';

export const DO_NOT_CONTACT_TAG = TAGS.doNotContact;
export const HELD_TAG = APPOINTMENT_TAGS.held;

type Template = {
  subject?: string;
  body: string;
  required: string[];
};

const EMAIL_SIGN = `Malik\n${EMAIL_FOOTER}`;

const TEMPLATES: Record<MessageType, Partial<Record<Channel, Template>>> = {
  application_received: {
    email: {
      subject: 'Got your application',
      required: ['first_name', 'booking_link'],
      body: `Hi {first_name},

Malik here. Your application came through.

The next step is picking a time for your free audit. It takes 30 minutes, and you leave with a blueprint of what to fix in how your leads get handled, whether we work together or not.

Grab a time here: {booking_link}

${EMAIL_SIGN}`,
    },
  },
  booking_confirmation: {
    email: {
      subject: "You're booked: {call_date_time}",
      required: ['first_name', 'call_date_time', 'meeting_link', 'reschedule_link'],
      body: `Hi {first_name},

You're confirmed for your free audit on {call_date_time}.

Meeting link: {meeting_link}

If you can, have your lead numbers handy: roughly how many leads come in each month, and how many get a call or text back within the first hour. It makes the blueprint far more accurate.

Need to change the time? {reschedule_link}

${EMAIL_SIGN}`,
    },
    sms: {
      required: ['first_name', 'call_date_time', 'meeting_link'],
      body: "Hi {first_name}, it's Malik at Divine Acquisition. You're confirmed for your audit on {call_date_time}. Link: {meeting_link}",
    },
  },
  reminder_24h: {
    email: {
      subject: 'Tomorrow: your audit at {call_date_time}',
      required: ['first_name', 'call_date_time', 'meeting_link', 'reschedule_link'],
      body: `Hi {first_name},

Quick reminder that your audit is tomorrow, {call_date_time}.

Link: {meeting_link}

If something came up, reschedule here: {reschedule_link}

${EMAIL_SIGN}`,
    },
  },
  reminder_2h: {
    sms: {
      required: ['first_name', 'call_time_only', 'meeting_link'],
      body: '{first_name}, your audit with Malik is at {call_time_only} today. Link: {meeting_link}',
    },
  },
  reminder_15m: {
    sms: {
      required: ['first_name', 'meeting_link'],
      body: "Starting in 15 minutes, {first_name}. Here's the link: {meeting_link}",
    },
  },
  no_show_text: {
    sms: {
      required: ['first_name', 'reschedule_link'],
      body: "{first_name}, it's Malik. Looks like we missed each other. Want to grab another time? {reschedule_link}",
    },
  },
  no_show_email: {
    email: {
      subject: 'We missed each other',
      required: ['first_name', 'reschedule_link'],
      body: `Hi {first_name},

We were supposed to connect for your audit today and it looks like it didn't line up. That happens.

If you still want the blueprint, pick a new time here: {reschedule_link}

If the timing isn't right anymore, no problem, and you don't need to reply.

${EMAIL_SIGN}`,
    },
  },
  reschedule_confirmation: {
    email: {
      subject: 'New time confirmed: {call_date_time}',
      required: ['first_name', 'call_date_time', 'meeting_link'],
      body: `Hi {first_name},

Your audit has moved to {call_date_time}.

Meeting link: {meeting_link}

${EMAIL_SIGN}`,
    },
    sms: {
      required: ['first_name', 'call_date_time', 'meeting_link'],
      body: '{first_name}, your audit is now {call_date_time}. Link: {meeting_link}',
    },
  },
  cancellation: {
    email: {
      subject: 'Your audit was cancelled',
      required: ['first_name', 'booking_link'],
      body: `Hi {first_name},

Your audit has been cancelled. If you want to pick it back up, you can choose a new time here: {booking_link}

${EMAIL_SIGN}`,
    },
  },
};

export const MESSAGE_CHANNELS: Record<MessageType, Channel[]> = {
  application_received: ['email'],
  booking_confirmation: ['email', 'sms'],
  reminder_24h: ['email'],
  reminder_2h: ['sms'],
  reminder_15m: ['sms'],
  no_show_text: ['sms'],
  no_show_email: ['email'],
  reschedule_confirmation: ['email', 'sms'],
  cancellation: ['email'],
};

const REMINDERS = new Set<MessageType>(['reminder_24h', 'reminder_2h', 'reminder_15m']);
const NO_SHOWS = new Set<MessageType>(['no_show_text', 'no_show_email']);
const IMMEDIATE = new Set<MessageType>([
  'application_received',
  'booking_confirmation',
  'reschedule_confirmation',
  'cancellation',
]);

export function templateFor(type: MessageType, channel: Channel): Template | null {
  return TEMPLATES[type][channel] ?? null;
}

export function isReminder(type: MessageType): boolean {
  return REMINDERS.has(type);
}

export function isNoShow(type: MessageType): boolean {
  return NO_SHOWS.has(type);
}

export function isImmediate(type: MessageType): boolean {
  return IMMEDIATE.has(type);
}
