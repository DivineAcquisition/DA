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

export function wistiaAspectRatio(aspect: '16/9' | '9/16'): string {
  return aspect === '9/16' ? '0.5625' : GO_WISTIA_ASPECT;
}
