/** First-touch stays. Last-touch updates only when a visit brings parameters. */

export const TOUCH_KEYS = ['source', 'medium', 'campaign', 'content', 'term', 'id'] as const;

export type TouchKey = (typeof TOUCH_KEYS)[number];
export type Touch = Record<TouchKey, string>;

const TRACKING_TO_TOUCH: Record<TouchKey, string> = {
  source: 'utm_source',
  medium: 'utm_medium',
  campaign: 'utm_campaign',
  content: 'utm_content',
  term: 'utm_term',
  id: 'utm_id',
};

export function emptyTouch(): Touch {
  return { source: '', medium: '', campaign: '', content: '', term: '', id: '' };
}

export function directTouch(): Touch {
  return { source: 'direct', medium: '', campaign: '', content: 'direct', term: '', id: '' };
}

export function touchFromTracking(tracking: Record<string, string | undefined> | undefined | null): Touch | null {
  if (!tracking) return null;
  const touch = emptyTouch();
  let any = false;
  for (const key of TOUCH_KEYS) {
    const raw = tracking[TRACKING_TO_TOUCH[key]];
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) continue;
    touch[key] = value;
    any = true;
  }
  return any ? touch : null;
}

export function sourceAdFrom(first: Touch, last: Touch): string {
  if (first.content && first.content !== 'direct') return first.content;
  if (last.content && last.content !== 'direct') return last.content;
  return 'direct';
}

export function mergeAttribution(
  stored: { first: Touch | null; last: Touch | null },
  incoming: Touch | null,
): { first: Touch; last: Touch; sourceAd: string } {
  const first = stored.first ?? incoming ?? directTouch();
  const last = incoming ?? stored.last ?? first;
  return { first, last, sourceAd: sourceAdFrom(first, last) };
}
