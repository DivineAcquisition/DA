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

/** Precall briefing Wistia media id (issued embed). */
export const ACQ_PRECALL_WISTIA_MEDIA_ID = 'pk21l05fbv';

/** Meta Pixel id for the acq landing. Env overrides; default ships the ads pixel. */
export const ACQ_META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || '2779578425739507';

/**
 * Conversion event fired after /api/submit-lead succeeds, before redirect.
 * Must match the event Meta ads is optimizing toward.
 */
export const ACQ_PIXEL_LEAD_EVENT = (
  process.env.NEXT_PUBLIC_ACQ_PIXEL_LEAD_EVENT?.trim() || 'Lead'
) as 'Lead' | 'CompleteRegistration';

/** GHL inbound webhook / form endpoint. Same pipeline as the rest of the acq stack. */
export const ACQ_GHL_WEBHOOK_URL = process.env.ACQ_GHL_WEBHOOK_URL?.trim() || '';

/** Optional GHL form id when posting through the forms API instead of a webhook. */
export const ACQ_GHL_FORM_ID = process.env.ACQ_GHL_FORM_ID?.trim() || '';

/**
 * Client-acquisition GHL location only. Never fall back to GHL_LOCATION_ID —
 * that env is the talent Assessment Interview subaccount.
 */
export const ACQ_GHL_LOCATION_ID =
  process.env.ACQ_GHL_LOCATION_ID?.trim() || process.env.GHL_ACQ_LOCATION_ID?.trim() || '';

/** Private Integration Token. GHL_PIT_KEY is accepted as an alias. */
export const GHL_PIT_TOKEN =
  process.env.GHL_PIT_TOKEN?.trim() || process.env.GHL_PIT_KEY?.trim() || '';

/** Optional GHL custom-field ids when the location uses non-standard names. */
export const GHL_FIELD_COMPANY_NAME = process.env.GHL_FIELD_COMPANY_NAME?.trim() || '';
export const GHL_FIELD_AD_SPEND = process.env.GHL_FIELD_AD_SPEND?.trim() || '';
export const GHL_FIELD_FOLLOW_UP = process.env.GHL_FIELD_FOLLOW_UP?.trim() || '';
export const GHL_FIELD_PROGRAM_PRICE = process.env.GHL_FIELD_PROGRAM_PRICE?.trim() || '';
export const GHL_FIELD_READINESS = process.env.GHL_FIELD_READINESS?.trim() || '';
export const GHL_FIELD_QUAL_RESULT = process.env.GHL_FIELD_QUAL_RESULT?.trim() || '';

export const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY?.trim() || '';
export const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID?.trim() || 'apprsfnMvzEAfsg39';
export const AIRTABLE_LEADS_TABLE_ID =
  process.env.AIRTABLE_LEADS_TABLE_ID?.trim() || 'tblDgFYwsGzoDqzF1';

/**
 * Airtable Entry Point select. "Landing Page" is the intended value but is not
 * a choice on the Leads table yet — default stays Audit Booking so writes succeed.
 */
export const AIRTABLE_ENTRY_POINT = process.env.AIRTABLE_ENTRY_POINT?.trim() || 'Audit Booking';

/** Optional Slack/webhook URL for Step 2/3 pipeline failures. */
export const ACQ_ERROR_WEBHOOK = process.env.ACQ_ERROR_WEBHOOK?.trim() || '';

export const ACQ_THANK_YOU_PATH = '/thank-you';
export const ACQ_BOOK_PATH = '/book';
export const ACQ_PRECALL_PATH = '/precall';

/** Optional Typeform apply URL. The landing CTA uses /book (GHL calendar). */
export const ACQ_TYPEFORM_DEFAULT_URL = 'https://form.typeform.com/to/lvtP8G4E';
export const ACQ_TYPEFORM_URL =
  process.env.NEXT_PUBLIC_ACQ_TYPEFORM_URL?.trim() || ACQ_TYPEFORM_DEFAULT_URL;

export const ACQ_CALENDAR_WIDGET_ID = 'v0e24e3kxYEGCTUkSP4A';
export const ACQ_CALENDAR_IFRAME_ID = 'sJewwAfFLhmwqP9psUxK_1787884446665';
export const ACQ_CALENDAR_EMBED_SCRIPT =
  'https://link.msgsndr.divineacquisition.io/js/form_embed.js';
export const ACQ_CALENDAR_DEFAULT_EMBED_URL = `https://link.msgsndr.divineacquisition.io/widget/booking/${ACQ_CALENDAR_WIDGET_ID}`;

/**
 * GHL booking calendar iframe src. Env override wins; otherwise the issued
 * msgsndr widget. Also accepts a widget id and builds a LeadConnector URL.
 */
const calendarEmbedFromEnv = process.env.NEXT_PUBLIC_ACQ_CALENDAR_EMBED_URL?.trim() || '';
const calendarWidgetFromEnv = process.env.NEXT_PUBLIC_ACQ_CALENDAR_WIDGET_ID?.trim() || '';
export const ACQ_CALENDAR_EMBED_URL =
  calendarEmbedFromEnv ||
  (calendarWidgetFromEnv
    ? `https://api.leadconnectorhq.com/widget/booking/${calendarWidgetFromEnv}`
    : ACQ_CALENDAR_DEFAULT_EMBED_URL);

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

/** Dedicated acq host uses bare paths; localhost and previews stay under /acq. */
export function isAcqHost(host?: string | null): boolean {
  const hostname = (host ?? '').toLowerCase().split(':')[0];
  if (!hostname) return false;
  const acqHost = new URL(ACQ_PUBLIC_ORIGIN).hostname;
  return (
    hostname === acqHost ||
    (hostname.startsWith('acq.') && hostname.endsWith('.divineacquisition.io'))
  );
}

export function acqPublicPath(pathname: string, host?: string | null): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return isAcqHost(host) ? path : `/acq${path}`;
}

export function qualificationThankYouPath(host?: string): string {
  return acqPublicPath(ACQ_THANK_YOU_PATH, host);
}

export function withTrackingQuery(
  pathname: string,
  tracking: Partial<Record<TrackingParamKey, string>>,
): string {
  const params = new URLSearchParams();
  for (const key of TRACKING_PARAM_KEYS) {
    const value = tracking[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Typeform apply URL with ad params forwarded as hidden fields. */
export function acqApplyUrl(
  tracking: Partial<Record<TrackingParamKey, string>> = {},
): string {
  return withTrackingParams(ACQ_TYPEFORM_URL, tracking);
}

/** Landing CTA destination: GHL calendar on /book, with ad params forwarded. */
export function acqBookUrl(
  tracking: Partial<Record<TrackingParamKey, string>> = {},
  host?: string | null,
): string {
  return withTrackingQuery(acqPublicPath(ACQ_BOOK_PATH, host), tracking);
}
