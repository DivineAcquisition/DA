/** Talent booking + assessment admin host/config helpers. */

export const TALENT_BOOKING_URL =
  process.env.NEXT_PUBLIC_TALENT_HOST ?? 'https://talent.divineacquisition.io';

export const ASSESSMENT_ADMIN_HOST =
  process.env.NEXT_PUBLIC_ASSESSMENT_ADMIN_HOST ?? 'https://admin.divineacquisition.io';

/** Always CC'd on assessment invite emails. Comma-separated override via env. */
export const RESEND_CC = (
  process.env.RESEND_CC ?? 'malik@divineacquisition.io'
)
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean);

/** Talent acquisition subaccount location. Empty until GHL_LOCATION_ID is set. */
export const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID?.trim() || '';
/** Assessment Interview calendar. Empty until GHL_CALENDAR_ID is set. */
export const GHL_CALENDAR_ID = process.env.GHL_CALENDAR_ID?.trim() || '';

export const BOOKING_WIDGET_SRC = GHL_CALENDAR_ID
  ? `https://link.msgsndr.divineacquisition.io/widget/booking/${GHL_CALENDAR_ID}`
  : '';

export const BOOKING_EMBED_SCRIPT =
  'https://link.msgsndr.divineacquisition.io/js/form_embed.js';

export function bookingLinkForToken(token: string): string {
  return `${TALENT_BOOKING_URL.replace(/\/$/, '')}/${token}`;
}

export function thankYouUrl(token?: string): string {
  const base = `${TALENT_BOOKING_URL.replace(/\/$/, '')}/thankyou`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
