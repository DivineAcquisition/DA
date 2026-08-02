/** Acquisition pilot landing host + booking config. */

export const ACQ_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_ACQ_HOST?.replace(/\/$/, '') ?? 'https://acq.divineacquisition.io';

/** External booking calendar / widget the CTA opens. */
export const ACQ_BOOKING_URL =
  process.env.NEXT_PUBLIC_ACQ_BOOKING_URL?.trim() ||
  'https://link.msgsndr.divineacquisition.io/widget/booking/acq-pilot';

/** Optional Wistia media id. When unset the video frame still renders empty. */
export const ACQ_WISTIA_MEDIA_ID = process.env.NEXT_PUBLIC_ACQ_WISTIA_ID?.trim() || '';

/** Ad / click identifiers forwarded from the landing URL into the booking URL. */
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
