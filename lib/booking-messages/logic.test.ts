import { describe, expect, it } from 'vitest';
import { readBookingMessageConfig, type BookingMessageConfig } from './config';
import { EMAIL_FOOTER, MESSAGE_CHANNELS } from './copy';
import {
  afterFailedSend,
  applyDecision,
  dueMessages,
  emptyContact,
  formatCallDateTime,
  ingest,
  isProblem,
  isStop,
  knownPerson,
  markSent,
  prepareSend,
  renderTemplate,
  resolveTimeZone,
  safeError,
  shouldWriteTouch,
  smsSegments,
  withPerson,
} from './logic';
import type { ContactSnapshot, NormalizedEvent, Slice } from './types';

const START = '2026-10-15T18:00:00.000Z';
const NOW = new Date('2026-10-01T15:00:00.000Z');

function config(overrides: Partial<BookingMessageConfig> = {}): BookingMessageConfig {
  return {
    ...readBookingMessageConfig({}),
    mode: 'live',
    texting: true,
    emailing: true,
    fromEmail: 'malik@divineacquisition.io',
    testContactId: 'test-contact',
    ...overrides,
  };
}

function person() {
  return knownPerson({
    email: 'jordan@example.com',
    phone: '2025550148',
    fullName: 'Jordan Blake',
    timeZone: 'America/New_York',
    smsConsent: true,
    smsConsentAt: '2026-10-01T14:00:00.000Z',
    smsConsentWordingVersion: 'acq-audit-2026-10-11',
    smsConsentPageUrl: 'https://acq.divineacquisition.io/',
    ghlContactId: 'ghl-jordan',
    airtableRecordId: 'recJordan',
  });
}

function booked(extra: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    type: 'booked',
    email: 'jordan@example.com',
    phone: '+12025550148',
    fullName: 'Jordan Blake',
    timeZone: 'America/New_York',
    startsAt: START,
    endsAt: '2026-10-15T18:30:00.000Z',
    bookingId: 'book-1',
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    rescheduleLink: 'https://acq.divineacquisition.io/book',
    bookingLink: 'https://acq.divineacquisition.io/book',
    smsConsent: true,
    ...extra,
  };
}

function typesOf(slice: Slice, status?: string) {
  return slice.messages
    .filter((message) => (status ? message.status === status : true))
    .map((message) => `${message.type}:${message.channel}:${message.status}`)
    .sort();
}

function deliver(slice: Slice, now: Date, settings: BookingMessageConfig, contact: ContactSnapshot = emptyContact()) {
  const sent: string[] = [];
  let next = slice;
  const due = dueMessages(next, now);
  const messages = next.messages.map((message) => {
    if (!due.some((item) => item.id === message.id)) return message;
    const owner = next.people.find((item) => item.id === message.personId)!;
    const booking = next.bookings.find((item) => item.id === message.bookingId) ?? null;
    const decision = prepareSend({
      message,
      person: owner,
      booking,
      bookings: next.bookings,
      contact,
      config: settings,
      now,
    });
    if (decision.action === 'send') {
      sent.push(`${message.type}:${message.channel}:${decision.contactId}`);
      return markSent(message, now, decision.dryRun ? null : `ghl-${message.id}`, decision.dryRun);
    }
    return applyDecision(message, decision, now);
  });
  next = { ...next, messages };
  return { slice: next, sent };
}

describe('booking message rules', () => {
  it('writes the call time the way the emails read it', () => {
    expect(formatCallDateTime(START, 'America/New_York')).toBe('Thursday, October 15 at 2:00 PM ET');
  });

  it('keeps every email on the plain footer and every text inside two segments', () => {
    const settings = config();
    const slice = ingest(withPerson(person()), booked(), NOW, settings).slice;
    for (const message of slice.messages) {
      const owner = slice.people[0];
      const booking = slice.bookings[0];
      const decision = prepareSend({
        message: { ...message, status: 'pending', scheduledFor: NOW.toISOString(), reason: '', final: false },
        person: owner,
        booking,
        bookings: slice.bookings,
        contact: emptyContact(),
        config: settings,
        now: NOW,
      });
      if (decision.action !== 'send') continue;
      if (message.channel === 'email') expect(decision.rendered.body).toContain(EMAIL_FOOTER);
      if (message.channel === 'sms') expect(smsSegments(decision.rendered.body)).toBeLessThanOrEqual(2);
    }
  });

  it('1. a booking queues the confirmation and the reminder set', () => {
    const slice = ingest(withPerson(person()), booked(), NOW, config()).slice;
    expect(typesOf(slice, 'pending')).toEqual([
      'booking_confirmation:email:pending',
      'booking_confirmation:sms:pending',
      'no_show_email:email:pending',
      'no_show_text:sms:pending',
      'reminder_15m:sms:pending',
      'reminder_24h:email:pending',
      'reminder_2h:sms:pending',
    ]);
  });

  it('2. a lead without SMS consent gets emails only', () => {
    const lead = person();
    lead.smsConsent = false;
    const queued = ingest(withPerson(lead), booked({ smsConsent: false }), NOW, config()).slice;
    const { slice, sent } = deliver(queued, NOW, config());
    expect(sent.every((item) => item.startsWith('booking_confirmation:email'))).toBe(true);
    expect(slice.messages.filter((message) => message.channel === 'sms' && message.status === 'sent')).toHaveLength(0);
    const sms = slice.messages.find((message) => message.id.includes('booking_confirmation:sms'));
    expect(sms?.status).toBe('skipped');
    expect(sms?.reason).toBe('consent');
    expect(sms?.final).toBe(true);
  });

  it('3. a do-not-contact lead receives nothing', () => {
    const lead = person();
    lead.doNotContact = true;
    const queued = ingest(withPerson(lead), booked(), NOW, config()).slice;
    const { sent, slice } = deliver(queued, NOW, config());
    expect(sent).toEqual([]);
    expect(slice.messages.find((message) => message.type === 'booking_confirmation')?.reason).toBe('do_not_contact');

    const tagged = ingest(withPerson(person()), booked(), NOW, config()).slice;
    const blocked = deliver(tagged, NOW, config(), { ...emptyContact(), tags: ['consent - do not contact'] });
    expect(blocked.sent).toEqual([]);
    const legacy = deliver(tagged, NOW, config(), { ...emptyContact(), tags: ['da-do-not-contact'] });
    expect(legacy.sent).toEqual([]);
  });

  it('4. STOP cancels every pending message and tags the lead', () => {
    const queued = ingest(withPerson(person()), booked(), NOW, config()).slice;
    const stopped = ingest(
      queued,
      { type: 'inbound', phone: '2025550148', body: 'STOP' },
      NOW,
      config(),
    );
    expect(stopped.flags).toContain('consent - do not contact');
    expect(stopped.slice.people[0].doNotContact).toBe(true);
    expect(stopped.slice.messages.every((message) => message.status === 'cancelled' && message.reason === 'stop')).toBe(
      true,
    );
    expect(isStop('stop')).toBe(true);
    expect(isStop('please stop by')).toBe(false);
  });

  it('5. marking a lead held cancels the pending no-show messages', () => {
    const queued = ingest(withPerson(person()), booked(), NOW, config()).slice;
    const held = ingest(queued, { type: 'held', bookingId: 'book-1', email: 'jordan@example.com' }, NOW, config());
    const noShows = held.slice.messages.filter((message) => message.type.startsWith('no_show'));
    expect(noShows.every((message) => message.status === 'cancelled' && message.reason === 'held')).toBe(true);
    expect(held.slice.messages.find((message) => message.type === 'reminder_15m')?.status).toBe('pending');
  });

  it('6. a no-show gets the text at +5 minutes and the email at +60, and nothing after', () => {
    const queued = ingest(withPerson(person()), booked(), NOW, config()).slice;
    const start = new Date(START);
    const atText = new Date(start.getTime() + 5 * 60_000);
    const atEmail = new Date(start.getTime() + 60 * 60_000);
    const afterText = deliver(queued, atText, config());
    expect(afterText.sent).toContain('no_show_text:sms:ghl-jordan');
    expect(afterText.sent.some((item) => item.startsWith('no_show_email'))).toBe(false);
    const afterEmail = deliver(afterText.slice, atEmail, config());
    expect(afterEmail.sent).toContain('no_show_email:email:ghl-jordan');
    const later = deliver(afterEmail.slice, new Date(start.getTime() + 3 * 60 * 60_000), config());
    expect(later.sent).toEqual([]);
    expect(MESSAGE_CHANNELS.no_show_email).toEqual(['email']);
  });

  it('7. rescheduling cancels the old reminders and creates the new set', () => {
    const queued = ingest(withPerson(person()), booked(), NOW, config()).slice;
    const moved = '2026-10-20T18:00:00.000Z';
    const next = ingest(
      queued,
      booked({ type: 'rescheduled', startsAt: moved, endsAt: '2026-10-20T18:30:00.000Z' }),
      NOW,
      config(),
    ).slice;
    const oldPending = next.messages.filter((message) => message.id.includes(START) && message.status === 'pending');
    expect(oldPending).toEqual([]);
    expect(next.messages.some((message) => message.id.includes(START) && message.status === 'cancelled')).toBe(true);
    expect(next.messages.some((message) => message.type === 'reschedule_confirmation' && message.id.includes(moved))).toBe(
      true,
    );
    expect(next.messages.some((message) => message.type === 'reminder_15m' && message.id.includes(moved) && message.status === 'pending')).toBe(
      true,
    );
  });

  it('8. cancelling cancels everything pending and sends the cancellation email', () => {
    const queued = ingest(withPerson(person()), booked(), NOW, config()).slice;
    const cancelled = ingest(queued, { type: 'cancelled', bookingId: 'book-1', email: 'jordan@example.com' }, NOW, config())
      .slice;
    expect(cancelled.messages.filter((message) => message.type !== 'cancellation').every((message) => message.status === 'cancelled')).toBe(
      true,
    );
    const email = cancelled.messages.find((message) => message.type === 'cancellation');
    expect(email?.status).toBe('pending');
    expect(email?.channel).toBe('email');
    const { sent } = deliver(cancelled, NOW, config());
    expect(sent).toEqual(['cancellation:email:ghl-jordan']);
  });

  it('9. a call 90 minutes away skips the 24-hour and 2-hour reminders and keeps the 15-minute one', () => {
    const now = new Date('2026-10-15T16:30:00.000Z');
    const starts = new Date(now.getTime() + 90 * 60_000).toISOString();
    const slice = ingest(
      withPerson(person()),
      booked({ startsAt: starts, endsAt: new Date(now.getTime() + 120 * 60_000).toISOString() }),
      now,
      config(),
    ).slice;
    expect(slice.messages.find((message) => message.type === 'reminder_24h')?.reason).toBe('too_late');
    expect(slice.messages.find((message) => message.type === 'reminder_2h')?.reason).toBe('too_late');
    expect(slice.messages.find((message) => message.type === 'reminder_15m')?.status).toBe('pending');
    const { sent } = deliver(slice, now, config());
    expect(sent.some((item) => item.startsWith('reminder_'))).toBe(false);
    expect(sent.some((item) => item.startsWith('booking_confirmation'))).toBe(true);
  });

  it('10. a missing merge value is not sent and is flagged', () => {
    const queued = ingest(withPerson(person()), booked(), NOW, config()).slice;
    queued.people[0].firstName = '';
    const { slice, sent } = deliver(queued, NOW, config());
    expect(sent).toEqual([]);
    const failed = slice.messages.find((message) => message.type === 'booking_confirmation' && message.channel === 'email');
    expect(failed?.status).toBe('failed');
    expect(failed?.reason).toBe('missing_merge');
    expect(failed?.final).toBe(true);
    expect(isProblem(failed!)).toBe(true);
  });

  it('11. the same booking event delivered twice produces one set of messages', () => {
    const first = ingest(withPerson(person()), booked({ eventId: 'evt-1' }), NOW, config());
    const second = ingest(first.slice, booked({ eventId: 'evt-2' }), NOW, config());
    expect(second.duplicate).toBe(true);
    expect(second.slice.messages).toHaveLength(first.slice.messages.length);
  });

  it('12. a text outside 8am to 9pm lead-local time is held, not sent', () => {
    const night = new Date('2026-10-14T02:00:00.000Z');
    const queued = ingest(withPerson(person()), booked(), NOW, config()).slice;
    const text = queued.messages.find((message) => message.type === 'booking_confirmation' && message.channel === 'sms')!;
    text.scheduledFor = night.toISOString();
    const decision = prepareSend({
      message: text,
      person: queued.people[0],
      booking: queued.bookings[0],
      bookings: queued.bookings,
      contact: emptyContact(),
      config: config(),
      now: night,
    });
    expect(decision.action).toBe('hold');
    if (decision.action === 'hold') {
      expect(decision.reason).toBe('quiet_hours');
      expect(formatCallDateTime(decision.scheduledFor, 'America/New_York')).toContain('8:00 AM ET');
    }
  });

  it('13. a stale message is skipped, not sent late', () => {
    const queued = ingest(withPerson(person()), booked(), NOW, config()).slice;
    const confirmation = queued.messages.find((message) => message.type === 'booking_confirmation' && message.channel === 'email')!;
    const late = new Date(new Date(confirmation.scheduledFor).getTime() + 13 * 60 * 60_000);
    const decision = prepareSend({
      message: confirmation,
      person: queued.people[0],
      booking: queued.bookings[0],
      bookings: queued.bookings,
      contact: emptyContact(),
      config: config(),
      now: late,
    });
    expect(decision.action).toBe('skip');
    if (decision.action === 'skip') expect(decision.reason).toBe('stale');
    expect(isProblem({ status: 'skipped', reason: 'stale', touchError: '', flagged: true })).toBe(true);
  });

  it('14. a failed send retries, then stays failed and shows in the failure view', () => {
    let message = ingest(withPerson(person()), booked(), NOW, config()).slice.messages[0];
    const settings = config();
    message = afterFailedSend(message, NOW, settings, 'ghl_down');
    expect(message.status).toBe('pending');
    expect(message.attempts).toBe(1);
    message = afterFailedSend(message, NOW, settings, 'ghl_down');
    expect(message.attempts).toBe(2);
    message = afterFailedSend(message, NOW, settings, 'ghl_down');
    expect(message.status).toBe('failed');
    expect(message.final).toBe(true);
    expect(isProblem(message)).toBe(true);
    expect(shouldWriteTouch(message)).toBe(false);
  });

  it('15. a real send can become a Touch, and a skip, cancel, or failure cannot', () => {
    const queued = ingest(withPerson(person()), booked(), NOW, config()).slice;
    const sent = markSent(queued.messages[0], NOW, 'ghl-msg-1', false);
    expect(shouldWriteTouch(sent)).toBe(true);
    expect(sent.ghlMessageId).toBe('ghl-msg-1');
    const dry = markSent(queued.messages[0], NOW, null, true);
    expect(shouldWriteTouch(dry)).toBe(false);
    const skipped = applyDecision(queued.messages[1], { action: 'skip', status: 'skipped', reason: 'consent', flagged: false }, NOW);
    const cancelled = applyDecision(queued.messages[1], { action: 'skip', status: 'cancelled', reason: 'held', flagged: false }, NOW);
    const failed = applyDecision(queued.messages[1], { action: 'fail', reason: 'missing_merge' }, NOW);
    expect(shouldWriteTouch(skipped)).toBe(false);
    expect(shouldWriteTouch(cancelled)).toBe(false);
    expect(shouldWriteTouch(failed)).toBe(false);
    expect(isProblem(cancelled)).toBe(false);
  });

  it('16. the token never survives an error string', () => {
    const pit = 'pit-01234567-89ab-cdef-0123-456789abcdef';
    expect(safeError(new Error(`GHL 401 Bearer ${pit} unauthorized`), [pit])).not.toContain(pit);
    expect(safeError(new Error(`GHL 401 Bearer ${pit} unauthorized`), [pit])).not.toContain('pit-');
  });

  it('sends a test-mode message only to the test contact', () => {
    const queued = ingest(withPerson(person()), booked(), NOW, config()).slice;
    const message = queued.messages.find((item) => item.channel === 'email' && item.type === 'booking_confirmation')!;
    const decision = prepareSend({
      message,
      person: queued.people[0],
      booking: queued.bookings[0],
      bookings: queued.bookings,
      contact: emptyContact(),
      config: config({ mode: 'test', testContactId: 'contact-test' }),
      now: NOW,
    });
    expect(decision.action).toBe('send');
    if (decision.action === 'send') expect(decision.contactId).toBe('contact-test');
  });

  it('uses the phone area code, then Eastern', () => {
    expect(resolveTimeZone({ phone: '4155550100' }).timeZone).toBe('America/Los_Angeles');
    expect(resolveTimeZone({ phone: '0000000000' }).source).toBe('eastern');
  });

  it('does not render a broken placeholder', () => {
    const rendered = renderTemplate('booking_confirmation', 'email', {
      first_name: 'Jordan',
      call_date_time: '',
      meeting_link: 'https://meet.google.com/abc-defg-hij',
      reschedule_link: 'https://acq.divineacquisition.io/book',
    });
    expect(rendered.ok).toBe(false);
  });

  it('queues the application email only until a booking exists', () => {
    const settings = config();
    const applied = ingest(
      withPerson(person()),
      { type: 'application', email: 'jordan@example.com', fullName: 'Jordan Blake', smsConsent: true },
      NOW,
      settings,
    ).slice;
    expect(applied.messages.map((message) => message.type)).toEqual(['application_received']);
    const bookedAfter = ingest(applied, booked(), new Date(NOW.getTime() + 60_000), settings).slice;
    expect(bookedAfter.messages.find((message) => message.type === 'application_received')?.status).toBe('cancelled');
  });
});
