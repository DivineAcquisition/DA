import { createHash } from 'node:crypto';
import { ROOFING_META_PIXEL_ID, type RoofingCapiEvent } from './roofing-pixel';

const GRAPH_VERSION = 'v21.0';

export function metaCapiAccessToken(): string {
  return process.env.META_CAPI_ACCESS_TOKEN?.trim() || '';
}

export function metaCapiTestEventCode(): string {
  return process.env.META_CAPI_TEST_EVENT_CODE?.trim() || '';
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashEmail(email: string): string | undefined {
  const normalised = email.trim().toLowerCase();
  if (!normalised.includes('@')) return undefined;
  return sha256(normalised);
}

/** Digits only. A 10-digit US number gets a leading 1, which is what Meta expects. */
export function hashPhone(phone: string): string | undefined {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    // already country-coded
  } else if (digits.length === 10) {
    digits = `1${digits}`;
  }
  if (digits.length < 8) return undefined;
  return sha256(digits);
}

export function hashName(name: string): string | undefined {
  const normalised = name.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (normalised.length < 2) return undefined;
  return sha256(normalised);
}

export function fbcFromFbclid(fbclid: string | undefined, now = Date.now()): string | undefined {
  const id = fbclid?.trim();
  if (!id) return undefined;
  return `fb.1.${now}.${id}`;
}

export function safeEventSourceUrl(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    const host = url.hostname.toLowerCase();
    const allowed =
      host === 'localhost' ||
      host.endsWith('.divineacquisition.io') ||
      host === 'divineacquisition.io' ||
      host.endsWith('.vercel.app');
    if (!allowed) return fallback;
    return url.toString().slice(0, 500);
  } catch {
    return fallback;
  }
}

export type RoofingCapiInput = {
  eventName: RoofingCapiEvent;
  eventId: string;
  eventSourceUrl?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  clientIp?: string;
  userAgent?: string;
  customData?: Record<string, string>;
};

export function roofingCapiBody(input: RoofingCapiInput, now = new Date()): Record<string, unknown> {
  const userData: Record<string, string> = {};
  const email = input.email ? hashEmail(input.email) : undefined;
  const phone = input.phone ? hashPhone(input.phone) : undefined;
  const firstName = input.firstName ? hashName(input.firstName) : undefined;
  if (email) userData.em = email;
  if (phone) userData.ph = phone;
  if (firstName) userData.fn = firstName;
  if (email) userData.external_id = email;
  if (input.fbp?.trim()) userData.fbp = input.fbp.trim().slice(0, 200);
  const fbc = input.fbc?.trim() || fbcFromFbclid(input.fbclid, now.getTime());
  if (fbc) userData.fbc = fbc.slice(0, 300);
  if (input.clientIp?.trim()) userData.client_ip_address = input.clientIp.trim().slice(0, 64);
  if (input.userAgent?.trim()) userData.client_user_agent = input.userAgent.trim().slice(0, 500);

  const event: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: Math.floor(now.getTime() / 1000),
    event_id: input.eventId.slice(0, 128),
    action_source: 'website',
    event_source_url: safeEventSourceUrl(
      input.eventSourceUrl,
      'https://acq.divineacquisition.io/roofing',
    ),
    user_data: userData,
  };
  if (input.customData && Object.keys(input.customData).length) {
    event.custom_data = input.customData;
  }

  const body: Record<string, unknown> = { data: [event] };
  const testCode = metaCapiTestEventCode();
  if (testCode) body.test_event_code = testCode;
  return body;
}

export async function sendRoofingCapi(
  input: RoofingCapiInput,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const token = metaCapiAccessToken();
  if (!token || !ROOFING_META_PIXEL_ID) {
    return { ok: false, skipped: true };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${ROOFING_META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(roofingCapiBody(input)),
        cache: 'no-store',
      },
    );
    const text = await response.text();
    if (!response.ok) {
      console.error('[meta-capi]', input.eventName, response.status, text.slice(0, 500));
      return { ok: false, error: 'Meta did not accept the event.' };
    }
    return { ok: true };
  } catch (error) {
    console.error('[meta-capi]', input.eventName, error);
    return { ok: false, error: 'Meta could not be reached.' };
  }
}
