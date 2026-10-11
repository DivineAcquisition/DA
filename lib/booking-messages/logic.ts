import { localDateTimeToIso } from '@/lib/datetime/local';
import { redact } from '@/lib/ghl/rules';
import { EMAIL_FOOTER, DO_NOT_CONTACT_TAG, HELD_TAG, MESSAGE_CHANNELS, isImmediate, isNoShow, isReminder, templateFor } from './copy';
import type { BookingMessageConfig } from './config';
import type {
  Booking,
  BookingStatus,
  Channel,
  ContactSnapshot,
  MessageType,
  NormalizedEvent,
  Person,
  QueuedMessage,
  RenderedMessage,
  SendDecision,
  Slice,
} from './types';

const STOP_WORDS = new Set([
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
  'revoke',
  'optout',
  'opt-out',
  'opt out',
]);

/** Eastern is the fallback. Area codes that span zones use the western one so a text is not early. */
const AREA_TIME_ZONES: Record<string, string> = {};

function zone(name: string, codes: string) {
  for (const code of codes.split(/\s+/)) AREA_TIME_ZONES[code] = name;
}

zone(
  'America/New_York',
  '201 202 203 207 212 215 216 217 219 229 231 234 239 240 248 252 267 269 272 276 301 302 304 305 313 315 317 321 330 336 339 347 351 352 380 386 401 404 407 410 412 413 419 434 440 443 470 475 478 484 502 508 513 516 517 518 540 551 561 567 570 571 585 586 603 607 609 610 614 616 617 631 646 678 680 703 704 706 716 717 718 724 727 732 734 740 754 757 762 770 772 774 781 786 803 804 810 813 814 828 843 845 848 856 857 859 860 862 863 864 865 878 904 908 910 912 914 917 919 929 931 934 937 941 947 954 959 973 978 980 984',
);
zone(
  'America/Chicago',
  '205 210 214 217 218 224 225 228 251 254 256 262 270 281 309 312 314 316 318 319 320 325 331 334 337 346 361 364 385 402 405 409 414 417 430 432 469 479 501 504 507 512 515 563 573 580 601 605 608 612 615 618 620 630 636 641 651 660 662 682 701 708 712 713 715 731 737 763 769 773 779 785 806 815 816 817 830 832 847 870 901 903 913 915 918 920 936 940 952 956 972 979 985',
);
zone('America/Denver', '303 307 385 406 435 505 575 719 720 801 970');
zone(
  'America/Los_Angeles',
  '206 208 209 213 253 310 323 360 385 408 415 424 425 442 458 503 509 510 530 541 559 562 564 619 626 628 650 657 661 669 702 707 714 725 747 760 775 805 818 831 858 909 916 925 949 951 971',
);
zone('America/Phoenix', '480 520 602 623 928');
zone('Pacific/Honolulu', '808');
zone('America/Anchorage', '907');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function digits(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizePhone(raw: string): string {
  const number = digits(raw);
  if (number.length === 10) return `+1${number}`;
  if (number.length === 11 && number.startsWith('1')) return `+${number}`;
  if (number.length >= 10 && number.length <= 15) return `+${number}`;
  return '';
}

export function validEmail(value: string): boolean {
  return EMAIL.test(value.trim()) && value.trim().length <= 320;
}

export function validPhone(value: string): boolean {
  const number = normalizePhone(value);
  if (!number) return false;
  const local = number.startsWith('+1') ? number.slice(2) : number.slice(1);
  if (local.length === 10 && (local.startsWith('0') || local.startsWith('1'))) return false;
  return !/^(\d)\1+$/.test(local);
}

export function isStop(body: string): boolean {
  const word = body.trim().toLowerCase().replace(/[.!\s]+$/g, '').replace(/\s+/g, ' ');
  return STOP_WORDS.has(word);
}

export function smsSegments(text: string): number {
  const gsm = [...text].every((char) => char.charCodeAt(0) <= 127);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  if (text.length <= single) return 1;
  return Math.ceil(text.length / multi);
}

export function firstNameOf(fullName: string, explicit?: string): string {
  const given = explicit?.trim();
  const source = given || fullName.trim();
  return source.split(/\s+/)[0] ?? '';
}

function validZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(input: { timeZone?: string; phone?: string }): {
  timeZone: string;
  source: Person['timeZoneSource'];
} {
  const given = input.timeZone?.trim() ?? '';
  if (given && validZone(given)) return { timeZone: given, source: 'given' };
  const phone = normalizePhone(input.phone ?? '');
  const area = phone.startsWith('+1') ? phone.slice(2, 5) : '';
  const fromArea = area ? AREA_TIME_ZONES[area] : '';
  if (fromArea) return { timeZone: fromArea, source: 'area_code' };
  return { timeZone: 'America/New_York', source: 'eastern' };
}

function zoneParts(date: Date, timeZone: string): { year: string; month: string; day: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
  };
}

export function withinQuietHours(date: Date, timeZone: string): boolean {
  const { hour, minute } = zoneParts(date, timeZone);
  const minutes = hour * 60 + minute;
  return minutes >= 8 * 60 && minutes < 21 * 60;
}

/** Next 8:00am in the lead's zone, today if it is still before 8. */
export function nextMorning(date: Date, timeZone: string): string | null {
  const parts = zoneParts(date, timeZone);
  const day = parts.hour < 8 ? Number(parts.day) : Number(parts.day) + 1;
  const monthIndex = Number(parts.month) - 1;
  const base = new Date(Date.UTC(Number(parts.year), monthIndex, day));
  const isoDate = base.toISOString().slice(0, 10);
  return localDateTimeToIso(`${isoDate}T08:00`, timeZone);
}

const ZONE_LABEL: Record<string, string> = {
  EDT: 'ET',
  EST: 'ET',
  CDT: 'CT',
  CST: 'CT',
  MDT: 'MT',
  MST: 'MT',
  PDT: 'PT',
  PST: 'PT',
};

export function formatCallDateTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
  const match = clock.match(/^(.*)\s+([A-Z]{2,5})$/);
  if (!match) return `${day} at ${clock}`;
  const label = ZONE_LABEL[match[2]] ?? match[2];
  return `${day} at ${match[1]} ${label}`;
}

export function formatCallTimeOnly(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function plainEmailHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#111">${escaped.replace(/\n/g, '<br>')}</div>`;
}

export type Merges = Record<string, string>;

export function renderTemplate(
  type: MessageType,
  channel: Channel,
  merges: Merges,
): { ok: true; rendered: RenderedMessage } | { ok: false; missing: string[] } {
  const template = templateFor(type, channel);
  if (!template) return { ok: false, missing: ['template'] };
  const missing = template.required.filter((key) => {
    const value = merges[key]?.trim() ?? '';
    return !value || value.includes('{') || value.includes('}');
  });
  if (missing.length) return { ok: false, missing };
  const fill = (source: string) => source.replace(/\{([a-z_]+)\}/g, (_, key: string) => merges[key]?.trim() ?? '');
  const body = fill(template.body);
  const subject = template.subject ? fill(template.subject) : '';
  if (/\{[a-z_]+\}/.test(body) || /\{[a-z_]+\}/.test(subject)) {
    return { ok: false, missing: ['placeholder'] };
  }
  if (channel === 'email' && !body.includes(EMAIL_FOOTER)) return { ok: false, missing: ['footer'] };
  if (channel === 'sms' && smsSegments(body) > 2) return { ok: false, missing: ['length'] };
  return { ok: true, rendered: { subject, body } };
}

export function emptyContact(): ContactSnapshot {
  return { id: null, email: null, phone: null, tags: [], dndAll: false, dndEmail: false, dndSms: false };
}

export function contactFromGhl(raw: unknown): ContactSnapshot {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const contact = (root.contact && typeof root.contact === 'object' ? root.contact : root) as Record<string, unknown>;
  const tags = Array.isArray(contact.tags) ? contact.tags.map((tag) => String(tag)) : [];
  const settings = (contact.dndSettings && typeof contact.dndSettings === 'object'
    ? contact.dndSettings
    : {}) as Record<string, { status?: string }>;
  const channelOn = (name: string) => String(settings[name]?.status ?? '').toLowerCase() === 'active';
  return {
    id: typeof contact.id === 'string' ? contact.id : null,
    email: typeof contact.email === 'string' ? contact.email : null,
    phone: typeof contact.phone === 'string' ? contact.phone : null,
    tags,
    dndAll: contact.dnd === true,
    dndEmail: channelOn('Email'),
    dndSms: channelOn('SMS'),
  };
}

export function channelBlocked(contact: ContactSnapshot, channel: Channel): boolean {
  if (contact.dndAll) return true;
  if (contact.tags.some((tag) => tag.toLowerCase() === DO_NOT_CONTACT_TAG)) return true;
  return channel === 'email' ? contact.dndEmail : contact.dndSms;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function emptySlice(): Slice {
  return { people: [], bookings: [], messages: [], seen: [] };
}

function personId(email: string, phone: string): string {
  if (email) return `person:${email}`;
  return `person:phone:${digits(phone)}`;
}

function findPerson(slice: Slice, event: NormalizedEvent): Person | null {
  const email = event.email?.trim().toLowerCase() ?? '';
  const phone = normalizePhone(event.phone ?? '');
  if (email) {
    const byEmail = slice.people.find((person) => person.email === email);
    if (byEmail) return byEmail;
  }
  if (phone) {
    const byPhone = slice.people.find((person) => person.phone && normalizePhone(person.phone) === phone);
    if (byPhone) return byPhone;
  }
  return null;
}

function upsertPerson(slice: Slice, event: NormalizedEvent): { person: Person; created: boolean } {
  const existing = findPerson(slice, event);
  const email = event.email?.trim().toLowerCase() ?? existing?.email ?? '';
  const phone = normalizePhone(event.phone ?? '') || existing?.phone || '';
  const zoneInfo = resolveTimeZone({ timeZone: event.timeZone || existing?.timeZone, phone });
  const fullName = event.fullName?.trim() || existing?.fullName || '';
  const firstName = firstNameOf(fullName, event.firstName) || existing?.firstName || '';
  const person: Person = {
    id: existing?.id ?? personId(email, phone),
    email,
    phone,
    firstName,
    fullName: fullName || firstName,
    timeZone: event.timeZone && validZone(event.timeZone) ? event.timeZone : existing?.timeZone || zoneInfo.timeZone,
    timeZoneSource: event.timeZone && validZone(event.timeZone) ? 'given' : existing?.timeZoneSource ?? zoneInfo.source,
    smsConsent: event.smsConsent ?? existing?.smsConsent ?? false,
    smsConsentAt: event.smsConsent ? event.smsConsentAt ?? existing?.smsConsentAt ?? null : existing?.smsConsentAt ?? null,
    smsConsentWordingVersion: event.smsConsent
      ? event.smsConsentWordingVersion ?? existing?.smsConsentWordingVersion ?? null
      : existing?.smsConsentWordingVersion ?? null,
    smsConsentPageUrl: event.smsConsent
      ? event.smsConsentPageUrl ?? existing?.smsConsentPageUrl ?? null
      : existing?.smsConsentPageUrl ?? null,
    ghlContactId: event.ghlContactId || existing?.ghlContactId || '',
    airtableRecordId: event.airtableRecordId || existing?.airtableRecordId || '',
    daLeadId: event.daLeadId || existing?.daLeadId || '',
    doNotContact: existing?.doNotContact ?? false,
    unmatched: existing ? existing.unmatched : true,
  };
  if (event.smsConsent === false) person.smsConsent = false;
  if (!existing) slice.people.push(person);
  else Object.assign(existing, person);
  return { person: existing ?? person, created: !existing };
}

function messageId(bookingKey: string, type: MessageType, channel: Channel, startsAt = ''): string {
  return startsAt ? `${bookingKey}:${startsAt}:${type}:${channel}` : `${bookingKey}:${type}:${channel}`;
}

function addMessage(
  slice: Slice,
  input: {
    personId: string;
    bookingId: string | null;
    bookingKey: string;
    type: MessageType;
    channel: Channel;
    scheduledFor: string;
    startsAt?: string;
    now: Date;
    tooLate: boolean;
  },
): void {
  const id = messageId(input.bookingKey, input.type, input.channel, input.startsAt);
  if (slice.messages.some((message) => message.id === id)) return;
  const late = input.tooLate && !isImmediate(input.type);
  slice.messages.push({
    id,
    personId: input.personId,
    bookingId: input.bookingId,
    type: input.type,
    channel: input.channel,
    scheduledFor: input.scheduledFor,
    status: late ? 'skipped' : 'pending',
    reason: late ? 'too_late' : '',
    final: late,
    attempts: 0,
    nextAttemptAt: null,
    ghlMessageId: null,
    dryRun: false,
    flagged: late,
    sentAt: null,
    touchError: '',
  });
}

function cancelPending(slice: Slice, predicate: (message: QueuedMessage) => boolean, reason: string) {
  for (const message of slice.messages) {
    if (message.status === 'pending' && predicate(message)) {
      message.status = 'cancelled';
      message.reason = reason;
      message.final = true;
      message.flagged = false;
    }
  }
}

function activeBooking(booking: Booking): boolean {
  return booking.status === 'booked' || booking.status === 'rescheduled' || booking.status === 'held';
}

function reminderSet(kind: 'booked' | 'rescheduled'): MessageType[] {
  const confirmation: MessageType = kind === 'rescheduled' ? 'reschedule_confirmation' : 'booking_confirmation';
  return [confirmation, 'reminder_24h', 'reminder_2h', 'reminder_15m', 'no_show_text', 'no_show_email'];
}

function scheduleFor(type: MessageType, startsAt: string, now: Date): string {
  const start = new Date(startsAt).getTime();
  if (type === 'reminder_24h') return new Date(start - 24 * 60 * 60_000).toISOString();
  if (type === 'reminder_2h') return new Date(start - 2 * 60 * 60_000).toISOString();
  if (type === 'reminder_15m') return new Date(start - 15 * 60_000).toISOString();
  if (type === 'no_show_text') return new Date(start + 5 * 60_000).toISOString();
  if (type === 'no_show_email') return new Date(start + 60 * 60_000).toISOString();
  return now.toISOString();
}

function canonicalKey(event: NormalizedEvent): string {
  return [
    event.type,
    event.bookingId ?? '',
    event.startsAt ?? '',
    event.email?.trim().toLowerCase() ?? '',
    normalizePhone(event.phone ?? ''),
    event.body?.trim().toLowerCase() ?? '',
  ].join('|');
}

export function eventKeys(event: NormalizedEvent): string[] {
  const keys = [`canon:${canonicalKey(event)}`];
  if (event.eventId?.trim()) keys.push(`id:${event.eventId.trim()}`);
  return keys;
}

export type IngestOutcome = {
  duplicate: boolean;
  unmatched: boolean;
  flags: string[];
  slice: Slice;
};

export function ingest(slice: Slice, event: NormalizedEvent, now: Date, config: BookingMessageConfig): IngestOutcome {
  const next = clone(slice);
  const keys = eventKeys(event);
  if (keys.some((key) => next.seen.includes(key))) {
    return { duplicate: true, unmatched: false, flags: [], slice: next };
  }
  next.seen.push(...keys);

  if (event.type === 'inbound') {
    const { person } = upsertPerson(next, event);
    if (isStop(event.body ?? '')) {
      person.doNotContact = true;
      cancelPending(next, (message) => message.personId === person.id, 'stop');
      return { duplicate: false, unmatched: person.unmatched, flags: ['stop', DO_NOT_CONTACT_TAG], slice: next };
    }
    return { duplicate: false, unmatched: person.unmatched, flags: [], slice: next };
  }

  const { person, created } = upsertPerson(next, event);
  if (event.type !== 'application' && created) person.unmatched = true;

  if (event.type === 'application') {
    const booked = next.bookings.some((booking) => booking.personId === person.id && activeBooking(booking));
    if (!booked) {
      addMessage(next, {
        personId: person.id,
        bookingId: null,
        bookingKey: `application:${person.email || person.id}`,
        type: 'application_received',
        channel: 'email',
        scheduledFor: new Date(now.getTime() + 3 * 60_000).toISOString(),
        now,
        tooLate: false,
      });
    }
    return { duplicate: false, unmatched: person.unmatched, flags: person.unmatched ? ['unmatched_booking'] : [], slice: next };
  }

  const externalId = event.bookingId?.trim() || `booking:${person.id}:${event.startsAt ?? now.toISOString()}`;
  let booking = next.bookings.find((item) => item.externalId === externalId);
  const startsAt = event.startsAt || booking?.startsAt || '';
  const endsAt = event.endsAt || booking?.endsAt || (startsAt ? new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString() : '');
  const timeZone = resolveTimeZone({ timeZone: event.timeZone || person.timeZone, phone: person.phone }).timeZone;
  if (!booking) {
    booking = {
      id: `booking:${externalId}`,
      externalId,
      personId: person.id,
      status: 'booked',
      startsAt,
      endsAt,
      timeZone,
      meetingLink: event.meetingLink?.trim() || '',
      rescheduleLink: event.rescheduleLink?.trim() || config.rescheduleLink,
      bookingLink: event.bookingLink?.trim() || config.bookingLink,
      unmatched: person.unmatched,
    };
    next.bookings.push(booking);
  } else {
    if (event.meetingLink?.trim()) booking.meetingLink = event.meetingLink.trim();
    if (event.rescheduleLink?.trim()) booking.rescheduleLink = event.rescheduleLink.trim();
    if (event.bookingLink?.trim()) booking.bookingLink = event.bookingLink.trim();
    if (event.timeZone && validZone(event.timeZone)) booking.timeZone = event.timeZone;
    booking.unmatched = person.unmatched;
  }

  const flags = person.unmatched ? ['unmatched_booking'] : [];

  if (event.type === 'held') {
    booking.status = 'held';
    cancelPending(next, (message) => message.bookingId === booking!.id && isNoShow(message.type), 'held');
    return { duplicate: false, unmatched: person.unmatched, flags, slice: next };
  }

  if (event.type === 'cancelled') {
    booking.status = 'cancelled';
    cancelPending(next, (message) => message.bookingId === booking!.id, 'cancelled');
    addMessage(next, {
      personId: person.id,
      bookingId: booking.id,
      bookingKey: booking.externalId,
      type: 'cancellation',
      channel: 'email',
      scheduledFor: now.toISOString(),
      now,
      tooLate: false,
    });
    return { duplicate: false, unmatched: person.unmatched, flags, slice: next };
  }

  if (event.type === 'no_show') {
    if (booking.status !== 'held') booking.status = 'no_show';
    return { duplicate: false, unmatched: person.unmatched, flags, slice: next };
  }

  if (event.type === 'booked' || event.type === 'rescheduled') {
    const previousStart = booking.startsAt;
    booking.startsAt = startsAt || booking.startsAt;
    booking.endsAt = endsAt || booking.endsAt;
    booking.status = event.type === 'rescheduled' ? 'rescheduled' : 'booked';
    if (event.type === 'rescheduled') {
      cancelPending(next, (message) => message.bookingId === booking!.id, 'rescheduled');
    }
    cancelPending(
      next,
      (message) => message.personId === person.id && message.type === 'application_received',
      'already_booked',
    );
    const kind = event.type === 'rescheduled' ? 'rescheduled' : 'booked';
    for (const type of reminderSet(kind)) {
      for (const channel of MESSAGE_CHANNELS[type]) {
        const scheduledFor = scheduleFor(type, booking.startsAt, now);
        const passed = new Date(scheduledFor).getTime() <= now.getTime();
        addMessage(next, {
          personId: person.id,
          bookingId: booking.id,
          bookingKey: booking.externalId,
          type,
          channel,
          scheduledFor,
          startsAt: booking.startsAt,
          now,
          tooLate: passed && (isReminder(type) || isNoShow(type)),
        });
      }
    }
    if (event.type === 'rescheduled' && previousStart && previousStart !== booking.startsAt) {
      flags.push('rescheduled');
    }
    return { duplicate: false, unmatched: person.unmatched, flags, slice: next };
  }

  return { duplicate: false, unmatched: person.unmatched, flags, slice: next };
}

function mergesFor(person: Person, booking: Booking | null, config: BookingMessageConfig): Record<string, string> {
  const timeZone = booking?.timeZone || person.timeZone || 'America/New_York';
  const startsAt = booking?.startsAt ?? '';
  return {
    first_name: person.firstName.trim(),
    call_date_time: startsAt ? formatCallDateTime(startsAt, timeZone) : '',
    call_time_only: startsAt ? formatCallTimeOnly(startsAt, timeZone) : '',
    meeting_link: booking?.meetingLink ?? '',
    reschedule_link: booking?.rescheduleLink || config.rescheduleLink,
    booking_link: booking?.bookingLink || config.bookingLink,
  };
}

function stale(message: QueuedMessage, now: Date, config: BookingMessageConfig): boolean {
  const due = new Date(message.scheduledFor).getTime();
  const windowMs = config.staleMinutes[message.type] * 60_000;
  return now.getTime() > due + windowMs;
}

export function prepareSend(input: {
  message: QueuedMessage;
  person: Person;
  booking: Booking | null;
  bookings: Booking[];
  contact: ContactSnapshot;
  config: BookingMessageConfig;
  now: Date;
}): SendDecision {
  const { message, person, booking, contact, config, now } = input;
  const blocked =
    person.doNotContact || contact.tags.some((tag) => tag.toLowerCase() === DO_NOT_CONTACT_TAG);
  if (blocked) return { action: 'skip', status: 'skipped', reason: 'do_not_contact', flagged: true };

  if (message.channel === 'sms' && !person.smsConsent) {
    return { action: 'skip', status: 'skipped', reason: 'consent', flagged: false };
  }

  if (message.type === 'application_received') {
    const booked = input.bookings.some((item) => item.personId === person.id && activeBooking(item));
    if (booked) return { action: 'skip', status: 'cancelled', reason: 'already_booked', flagged: false };
  }

  if (isNoShow(message.type)) {
    const held = booking?.status === 'held' || contact.tags.some((tag) => tag.toLowerCase() === HELD_TAG);
    if (held) return { action: 'skip', status: 'cancelled', reason: 'held', flagged: false };
  }

  if (booking && (booking.status === 'cancelled' || booking.status === 'no_show') && isReminder(message.type)) {
    return { action: 'skip', status: 'cancelled', reason: 'cancelled', flagged: false };
  }

  if (isReminder(message.type) && booking && now.getTime() >= new Date(booking.startsAt).getTime()) {
    return { action: 'skip', status: 'skipped', reason: 'call_started', flagged: true };
  }

  if (stale(message, now, config)) {
    return { action: 'skip', status: 'skipped', reason: 'stale', flagged: true };
  }

  const destinationOk = message.channel === 'email' ? validEmail(person.email) : validPhone(person.phone);
  if (!destinationOk && config.mode !== 'test') {
    return { action: 'skip', status: 'skipped', reason: 'missing_destination', flagged: true };
  }

  if (channelBlocked(contact, message.channel) && !person.doNotContact) {
    const dnd = message.channel === 'email' ? contact.dndEmail || contact.dndAll : contact.dndSms || contact.dndAll;
    if (dnd) return { action: 'skip', status: 'skipped', reason: 'dnd', flagged: true };
  }

  if (message.channel === 'sms' && !withinQuietHours(now, person.timeZone)) {
    const morning = nextMorning(now, person.timeZone);
    const start = booking ? new Date(booking.startsAt).getTime() : Number.POSITIVE_INFINITY;
    if (!morning || new Date(morning).getTime() >= start) {
      return { action: 'skip', status: 'skipped', reason: 'quiet_hours', flagged: true };
    }
    return { action: 'hold', scheduledFor: morning, reason: 'quiet_hours' };
  }

  if (message.channel === 'sms' && !config.texting) {
    return { action: 'hold', scheduledFor: message.scheduledFor, reason: 'texting_off' };
  }
  if (message.channel === 'email' && !config.emailing) {
    return { action: 'hold', scheduledFor: message.scheduledFor, reason: 'emailing_off' };
  }

  const rendered = renderTemplate(message.type, message.channel, mergesFor(person, booking, config));
  if (!rendered.ok) {
    const reason = rendered.missing.includes('length') ? 'too_long' : 'missing_merge';
    return { action: 'fail', reason };
  }

  if (config.mode === 'test') {
    if (!config.testContactId) return { action: 'fail', reason: 'test_contact_missing' };
    return { action: 'send', rendered: rendered.rendered, contactId: config.testContactId, dryRun: false };
  }
  if (config.mode === 'dry-run') {
    return { action: 'send', rendered: rendered.rendered, contactId: person.ghlContactId, dryRun: true };
  }
  if (message.channel === 'email' && !config.fromEmail) return { action: 'fail', reason: 'missing_sender' };
  return { action: 'send', rendered: rendered.rendered, contactId: person.ghlContactId || contact.id || '', dryRun: false };
}

export function applyDecision(message: QueuedMessage, decision: SendDecision, now: Date): QueuedMessage {
  if (decision.action === 'hold') {
    return { ...message, scheduledFor: decision.scheduledFor, reason: decision.reason, status: 'pending' };
  }
  if (decision.action === 'skip') {
    return {
      ...message,
      status: decision.status,
      reason: decision.reason,
      final: true,
      flagged: decision.flagged,
    };
  }
  if (decision.action === 'fail') {
    return { ...message, status: 'failed', reason: decision.reason, final: true, flagged: true };
  }
  return {
    ...message,
    status: 'sent',
    reason: decision.dryRun ? 'dry_run' : '',
    dryRun: decision.dryRun,
    ghlMessageId: decision.dryRun ? null : message.ghlMessageId,
    sentAt: now.toISOString(),
    final: true,
    flagged: false,
  };
}

export function afterFailedSend(
  message: QueuedMessage,
  now: Date,
  config: BookingMessageConfig,
  reason: string,
): QueuedMessage {
  const attempts = message.attempts + 1;
  if (attempts >= config.maxAttempts) {
    return {
      ...message,
      attempts,
      status: 'failed',
      reason,
      final: true,
      flagged: true,
      nextAttemptAt: null,
    };
  }
  const gap = config.retryMinutes[Math.min(attempts - 1, config.retryMinutes.length - 1)] ?? 30;
  return {
    ...message,
    attempts,
    status: 'pending',
    reason,
    flagged: false,
    final: false,
    nextAttemptAt: new Date(now.getTime() + gap * 60_000).toISOString(),
  };
}

export function markSent(message: QueuedMessage, now: Date, ghlMessageId: string | null, dryRun: boolean): QueuedMessage {
  return {
    ...message,
    status: 'sent',
    reason: dryRun ? 'dry_run' : '',
    dryRun,
    ghlMessageId,
    sentAt: now.toISOString(),
    final: true,
    flagged: Boolean(message.touchError),
  };
}

/** A Touch is written only for a message that was actually delivered. */
export function shouldWriteTouch(message: QueuedMessage): boolean {
  return message.status === 'sent' && !message.dryRun && !message.touchError;
}

export function isProblem(message: Pick<QueuedMessage, 'status' | 'reason' | 'touchError' | 'flagged'>): boolean {
  if (message.touchError) return true;
  if (message.status === 'failed') return true;
  if (message.status === 'skipped') return message.reason !== 'cancelled';
  return false;
}

export function dueMessages(slice: Slice, now: Date): QueuedMessage[] {
  return slice.messages.filter((message) => {
    if (message.status !== 'pending') return false;
    if (new Date(message.scheduledFor).getTime() > now.getTime()) return false;
    if (message.nextAttemptAt && new Date(message.nextAttemptAt).getTime() > now.getTime()) return false;
    return true;
  });
}

export function airtableLeadPatch(booking: Booking): Record<string, string> {
  const when = booking.startsAt
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: booking.timeZone || 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(booking.startsAt))
    : '';
  const fields: Record<string, string> = {
    Notes: `Booking status: ${booking.status}`,
  };
  if (when && booking.status !== 'cancelled') fields['Audit Booked Date'] = when;
  if (booking.meetingLink) fields['Google Meet URL'] = booking.meetingLink;
  if (booking.status === 'booked' || booking.status === 'rescheduled' || booking.status === 'held') {
    fields.Stage = 'Audit Booked';
  }
  return fields;
}

export function touchFields(input: {
  airtableRecordId: string;
  channel: Channel;
  type: MessageType;
  sentAt: string;
  leadName: string;
}): Record<string, unknown> {
  const date = input.sentAt.slice(0, 10);
  return {
    'Touch ID': `system-${input.type}-${input.channel}-${input.airtableRecordId}-${date}`,
    Date: date,
    Direction: 'Outbound',
    'Touch Class': 'System',
    Channel: input.channel === 'email' ? 'Email' : 'SMS',
    Outcome: 'Replied',
    Sentiment: 'Neutral',
    Summary: input.type,
    Lead: [input.airtableRecordId],
  };
}

export function knownPerson(partial: Partial<Person> & Pick<Person, 'email'>): Person {
  const zoneInfo = resolveTimeZone({ timeZone: partial.timeZone, phone: partial.phone });
  return {
    id: partial.id ?? personId(partial.email, partial.phone ?? ''),
    email: partial.email.trim().toLowerCase(),
    phone: normalizePhone(partial.phone ?? ''),
    firstName: partial.firstName ?? firstNameOf(partial.fullName ?? ''),
    fullName: partial.fullName ?? partial.firstName ?? '',
    timeZone: partial.timeZone && validZone(partial.timeZone) ? partial.timeZone : zoneInfo.timeZone,
    timeZoneSource: partial.timeZoneSource ?? (partial.timeZone ? 'given' : zoneInfo.source),
    smsConsent: partial.smsConsent ?? false,
    smsConsentAt: partial.smsConsentAt ?? null,
    smsConsentWordingVersion: partial.smsConsentWordingVersion ?? null,
    smsConsentPageUrl: partial.smsConsentPageUrl ?? null,
    ghlContactId: partial.ghlContactId ?? '',
    airtableRecordId: partial.airtableRecordId ?? '',
    daLeadId: partial.daLeadId ?? '',
    doNotContact: partial.doNotContact ?? false,
    unmatched: partial.unmatched ?? false,
  };
}

export function withPerson(person: Person): Slice {
  return { people: [person], bookings: [], messages: [], seen: [] };
}

export function bookingStatusOf(slice: Slice, externalId: string): BookingStatus | null {
  return slice.bookings.find((booking) => booking.externalId === externalId)?.status ?? null;
}

/** Errors stored or returned never keep a token, even when a provider echoes it. */
export function safeError(error: unknown, secrets: string[] = []): string {
  const text = error instanceof Error ? error.message : String(error ?? '');
  return redact(text, secrets);
}
