/** Talent booking + assessment admin host/config helpers. */

export const TALENT_BOOKING_URL =
  process.env.NEXT_PUBLIC_TALENT_HOST ?? 'https://talent.divineacquisition.io';

export const ASSESSMENT_ADMIN_HOST =
  process.env.NEXT_PUBLIC_ASSESSMENT_ADMIN_HOST ?? 'https://admin.divineacquisition.io';

export const RESEND_FROM =
  process.env.RESEND_FROM ?? 'Divine Acquisition Talent <noreply@noreply.divineacquisition.io>';

export const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO ?? undefined;

export const GHL_PIT_TOKEN = process.env.GHL_PIT_TOKEN ?? '';
export const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID ?? '';

export const BOOKING_WIDGET_SRC =
  'https://link.msgsndr.divineacquisition.io/widget/booking/3rTT9rZW2jG4lhZBae3D';

export const BOOKING_EMBED_SCRIPT =
  'https://link.msgsndr.divineacquisition.io/js/form_embed.js';

export function bookingLinkForToken(token: string): string {
  return `${TALENT_BOOKING_URL.replace(/\/$/, '')}/${token}`;
}

export function thankYouUrl(token?: string): string {
  const base = `${TALENT_BOOKING_URL.replace(/\/$/, '')}/thankyou`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
