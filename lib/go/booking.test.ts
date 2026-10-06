import { describe, expect, it } from 'vitest';
import { civilToday, slotsForDate } from '@/lib/calendar/slots';
import { parseGoBooking, normalizeBookingPhone } from './booking';
import { BOOKING } from './copy';

function openSlot() {
  const timeZone = 'America/New_York';
  let date = civilToday(timeZone);
  for (let day = 0; day < 21; day += 1) {
    const [year, month, dayOfMonth] = date.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, dayOfMonth + 1));
    date = next.toISOString().slice(0, 10);
    const slots = slotsForDate(date, timeZone);
    if (slots[0]) return { startsAt: slots[0], timeZone };
  }
  throw new Error('no open slot');
}

const valid = () => ({
  fullName: 'Jordan Blake',
  email: 'Jordan@Example.com',
  phone: '(555) 201-8890',
  showUp: true,
  smsConsent: true,
  emailConsent: true,
  website: '',
  ...openSlot(),
});

describe('cleaning funnel booking', () => {
  it('normalizes a US mobile number', () => {
    expect(normalizeBookingPhone('(555) 201-8890')).toBe('+15552018890');
  });

  it('requires the show-up commitment and both consents', () => {
    const declined = parseGoBooking({ ...valid(), showUp: false });
    expect(declined).toEqual({ ok: false, error: BOOKING.showUpDecline });
    const consent = parseGoBooking({ ...valid(), smsConsent: false });
    expect(consent.ok).toBe(false);
  });

  it('accepts a complete booking and lowercases the email', () => {
    const parsed = parseGoBooking(valid());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || parsed.honeypot) throw new Error('expected a booking');
    expect(parsed.value.email).toBe('jordan@example.com');
    expect(parsed.value.phone).toBe('+15552018890');
  });

  it('drops a honeypot submission before a booking is created', () => {
    expect(parseGoBooking({ ...valid(), website: 'https://spam.test' })).toEqual({ ok: true, honeypot: true });
  });
});
