/** Acquisition founding-install landing host + tracking + GHL + pixel. */

export const ACQ_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_ACQ_HOST?.replace(/\/$/, '') ?? 'https://acq.divineacquisition.io';

/**
 * Hero Wistia media id for the issued embed. Ignore a stale
 * NEXT_PUBLIC_ACQ_WISTIA_ID if it still points at the old player.
 */
const wistiaFromEnv = process.env.NEXT_PUBLIC_ACQ_WISTIA_ID?.trim() || '';
export const ACQ_WISTIA_MEDIA_ID =
  !wistiaFromEnv || wistiaFromEnv === 'h8ncqjru31' ? 'topebzrych' : wistiaFromEnv;

/** Native aspect ratio for the hero Wistia player (width / height). */
export const ACQ_WISTIA_ASPECT = '1.7777777777777777';

/** Meta Pixel id. Empty means the snippet is not injected. */
export const ACQ_META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '';

/**
 * Conversion event fired on /thank-you after a qualification submit.
 * Must match the event Zap 6 / Meta ads is optimizing toward.
 */
export const ACQ_PIXEL_LEAD_EVENT = (
  process.env.NEXT_PUBLIC_ACQ_PIXEL_LEAD_EVENT?.trim() || 'Lead'
) as 'Lead' | 'CompleteRegistration';

/** GHL inbound webhook / form endpoint. Same pipeline as the rest of the acq stack. */
export const ACQ_GHL_WEBHOOK_URL = process.env.ACQ_GHL_WEBHOOK_URL?.trim() || '';

/** Optional GHL form id when posting through the forms API instead of a webhook. */
export const ACQ_GHL_FORM_ID = process.env.ACQ_GHL_FORM_ID?.trim() || '';

/**
 * Client-acquisition location. Defaults to the shared GHL location when unset.
 * Keep talent booking on its own location; override this if the founding-install
 * pipeline lives in a different subaccount.
 */
export const ACQ_GHL_LOCATION_ID = process.env.ACQ_GHL_LOCATION_ID?.trim() || '';

export const GHL_PIT_TOKEN = process.env.GHL_PIT_TOKEN?.trim() || '';

/** Ad / click identifiers forwarded from the landing URL into the application. */
export const TRACKING_PARAM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'ttclid',
  'msclkid',
  'li_fat_id',
  'ref',
] as const;

export type TrackingParamKey = (typeof TRACKING_PARAM_KEYS)[number];

export type SearchParams = Record<string, string | string[] | undefined>;

export function trackingFromSearchParams(
  searchParams: SearchParams,
): Partial<Record<TrackingParamKey, string>> {
  const tracking: Partial<Record<TrackingParamKey, string>> = {};
  for (const key of TRACKING_PARAM_KEYS) {
    const value = searchParams[key];
    const single = Array.isArray(value) ? value[0] : value;
    if (single) tracking[key] = single;
  }
  return tracking;
}

export function withTrackingParams(
  baseUrl: string,
  params: URLSearchParams | Record<string, string | undefined | null>,
): string {
  const url = new URL(baseUrl, ACQ_PUBLIC_ORIGIN);
  const source =
    params instanceof URLSearchParams
      ? params
      : new URLSearchParams(
          Object.entries(params).flatMap(([key, value]) =>
            value == null || value === '' ? [] : [[key, value]],
          ),
        );

  for (const key of TRACKING_PARAM_KEYS) {
    const value = source.get(key);
    if (value) url.searchParams.set(key, value);
  }

  return url.toString();
}

/** Path-based on localhost/previews; bare /thank-you on the dedicated acq host. */
export function qualificationThankYouPath(host?: string): string {
  const hostname = (host ?? '').toLowerCase().split(':')[0];
  const acqHost = new URL(ACQ_PUBLIC_ORIGIN).hostname;
  if (
    hostname === acqHost ||
    (hostname.startsWith('acq.') && hostname.endsWith('.divineacquisition.io'))
  ) {
    return '/thank-you';
  }
  return '/acq/thank-you';
}
