/** Cleaning-company funnel on go.divineacquisition.io. Visual system matches the coaches page; the offer does not. */

export const GO_PUBLIC_ORIGIN = 'https://go.divineacquisition.io';

/** Meta Pixel from the original revenueweave-hub funnel. Not the coaches pixel. */
export const GO_META_PIXEL_ID =
  process.env.NEXT_PUBLIC_GO_META_PIXEL_ID?.trim() || '658113660313482';

/** Hero VSL issued on the cleaning landing. */
export const GO_VSL_MEDIA_ID = 'wl1hcmrxj5';

/** "AI booking layer" demo opened from the hero. */
export const GO_DEMO_MEDIA_ID = 'odrdmxlrvq';

export const GO_WISTIA_ASPECT = '1.7777777777777777';

/** Briefing shown after a strategy session is booked. Same film as the coaches precall page. */
export const GO_PRECALL_MEDIA_ID = 'pk21l05fbv';
export const GO_PRECALL_PATH = '/precall';
export const GO_PRECALL_URL = 'https://go.divineacquisition.io/precall';

export function isGoHost(host?: string | null): boolean {
  const hostname = (host ?? '').toLowerCase().split(':')[0];
  return (
    hostname === 'go.divineacquisition.io' ||
    (hostname.startsWith('go.') && hostname.endsWith('.divineacquisition.io'))
  );
}

/** Bare /precall on the cleaning host. Prefixed on localhost and previews. */
export function goPrecallHref(host?: string | null): string {
  return isGoHost(host) ? GO_PRECALL_PATH : `/go${GO_PRECALL_PATH}`;
}

export function wistiaAspectRatio(aspect: '16/9' | '9/16'): string {
  return aspect === '9/16' ? '0.5625' : GO_WISTIA_ASPECT;
}
