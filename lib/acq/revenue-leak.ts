import { NICHE_PASSTHROUGH_KEYS, NICHE_TRACKING_KEYS, type NicheVisit } from './niche-tracking';

/** Ads pixel for the Revenue Leak Audit. Public id, safe in the browser. */
export const REVENUE_LEAK_META_PIXEL_ID =
  process.env.NEXT_PUBLIC_REVENUE_LEAK_META_PIXEL_ID?.trim() || '658113660313482';

export function isRevenueLeakPath(pathname: string): boolean {
  return (
    pathname === '/leak' ||
    pathname.startsWith('/leak/') ||
    pathname === '/acq/leak' ||
    pathname.startsWith('/acq/leak/')
  );
}

const TRACKING_KEYS = [...NICHE_TRACKING_KEYS, ...NICHE_PASSTHROUGH_KEYS] as const;

/** iClosed embed URL with the ad click ids from this visit. */
export function revenueLeakEmbedUrl(
  base: string,
  tracking: NicheVisit = {},
  click: { fbp?: string; fbc?: string } = {},
): string {
  const trimmed = base.trim();
  if (!trimmed) return '';
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
  for (const key of TRACKING_KEYS) {
    const value = tracking[key];
    if (value) url.searchParams.set(key, value);
  }
  if (click.fbp?.trim()) url.searchParams.set('fbp', click.fbp.trim());
  if (click.fbc?.trim()) url.searchParams.set('fbc', click.fbc.trim());
  return url.toString();
}

export type VslEmbed =
  | { kind: 'iframe'; src: string }
  | { kind: 'video'; src: string }
  | { kind: 'empty' };

/** Turns a pasted VSL link into a player src. Empty or unsafe values stay empty. */
export function vslEmbed(raw: string): VslEmbed {
  const value = raw.trim();
  if (!value) return { kind: 'empty' };
  if (/\.(mp4|webm)(\?|$)/i.test(value)) return { kind: 'video', src: value };

  const youtube = value.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i,
  );
  if (youtube) {
    return { kind: 'iframe', src: `https://www.youtube.com/embed/${youtube[1]}?autoplay=1&rel=0` };
  }

  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` };

  const wistia = value.match(
    /(?:wistia\.(?:com|net)\/(?:medias|embed)\/(?:iframe\/)?|fast\.wistia\.net\/embed\/iframe\/)([a-z0-9]+)/i,
  );
  if (wistia) {
    return { kind: 'iframe', src: `https://fast.wistia.net/embed/iframe/${wistia[1]}?autoPlay=true` };
  }

  if (/^[a-z0-9]{8,16}$/i.test(value)) {
    return { kind: 'iframe', src: `https://fast.wistia.net/embed/iframe/${value}?autoPlay=true` };
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { kind: 'empty' };
    return { kind: 'iframe', src: url.toString() };
  } catch {
    return { kind: 'empty' };
  }
}
