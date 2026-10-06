import { isOfferedSlot } from '@/lib/calendar/slots';
import { BOOKING } from './copy';

export type GoBookingInput = {
  fullName: string;
  email: string;
  phone: string;
  showUp: boolean;
  smsConsent: boolean;
  emailConsent: boolean;
  startsAt: string;
  timeZone: string;
  website?: string;
};

export type NormalizedGoBooking = {
  fullName: string;
  email: string;
  phone: string;
  startsAt: string;
  timeZone: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isGoHoneypot(input: Pick<GoBookingInput, 'website'>): boolean {
  return Boolean(input.website && input.website.trim());
}

/** Store a dialable number. Ten-digit US numbers get +1. */
export function normalizeBookingPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function parseGoBooking(
  input: GoBookingInput,
): { ok: true; honeypot: true } | { ok: true; honeypot: false; value: NormalizedGoBooking } | { ok: false; error: string } {
  if (isGoHoneypot(input)) return { ok: true, honeypot: true };

  const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  if (fullName.length < 2 || fullName.length > 80) {
    return { ok: false, error: 'Enter your full name.' };
  }

  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 320) {
    return { ok: false, error: 'Enter a valid email.' };
  }

  const phone = normalizeBookingPhone(input.phone);
  if (!phone) return { ok: false, error: 'Enter a mobile number for the text reminders.' };

  if (!input.showUp) return { ok: false, error: BOOKING.showUpDecline };
  if (!input.smsConsent || !input.emailConsent) {
    return { ok: false, error: 'Check both boxes so we can send the confirmation and reminders.' };
  }

  if (!isOfferedSlot(input.startsAt, input.timeZone)) {
    return { ok: false, error: 'Pick one of the open times.' };
  }

  return {
    ok: true,
    honeypot: false,
    value: { fullName, email, phone, startsAt: new Date(input.startsAt).toISOString(), timeZone: input.timeZone },
  };
}
