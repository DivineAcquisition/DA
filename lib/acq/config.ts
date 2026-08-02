/** Acquisition pilot landing host + booking config. */

export const ACQ_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_ACQ_HOST?.replace(/\/$/, '') ?? 'https://acq.divineacquisition.io';

/** Typeform the "BOOK A CALL" CTA opens. */
export const ACQ_BOOKING_URL =
  process.env.NEXT_PUBLIC_ACQ_BOOKING_URL?.trim() ||
  'https://form.typeform.com/to/lvtP8G4E?typeform-source=divineacquisition.io';

/** Hero Wistia media id. Override with NEXT_PUBLIC_ACQ_WISTIA_ID when needed. */
export const ACQ_WISTIA_MEDIA_ID =
  process.env.NEXT_PUBLIC_ACQ_WISTIA_ID?.trim() || 'h8ncqjru31';

/** Native aspect ratio for the hero Wistia player (width / height). */
export const ACQ_WISTIA_ASPECT = '2.060085836909871';

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
