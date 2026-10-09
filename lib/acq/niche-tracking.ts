/** Visit attribution for niche ads pages. Safe to import from client components. */

export const NICHE_TRACKING_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'placement',
  'campaign_id',
  'adset_id',
  'ad_id',
] as const;

/** Click ids the coaches pipeline already stores. Kept when the ad URL includes them. */
export const NICHE_PASSTHROUGH_KEYS = ['fbclid', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'msclkid'] as const;

const STORAGE_KEY = 'da-niche-attribution';

export type NicheTrackingKey = (typeof NICHE_TRACKING_KEYS)[number];
export type NichePassthroughKey = (typeof NICHE_PASSTHROUGH_KEYS)[number];
export type NicheVisitKey = NicheTrackingKey | NichePassthroughKey;
export type NicheVisit = Partial<Record<NicheVisitKey, string>>;

export type HeadlineVariant = 'default' | 'c1' | 'c2' | 'c3';

type LooseSearch = Record<string, string | string[] | undefined> | URLSearchParams;

const MAX_VALUE = 300;

let memoryVisit: NicheVisit = {};

function readLoose(search: LooseSearch, key: string): string {
  if (search instanceof URLSearchParams) return search.get(key)?.trim() ?? '';
  const value = search[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() ?? '';
}

function assignKey(target: NicheVisit, key: NicheVisitKey, value: string) {
  if (!value) return;
  target[key] = value.slice(0, MAX_VALUE);
}

export function emptyNicheVisit(): NicheVisit {
  return {};
}

export function nicheTrackingFromSearch(search: LooseSearch): NicheVisit {
  const tracking: NicheVisit = {};
  for (const key of NICHE_TRACKING_KEYS) assignKey(tracking, key, readLoose(search, key));
  for (const key of NICHE_PASSTHROUGH_KEYS) assignKey(tracking, key, readLoose(search, key));
  return tracking;
}

export function sanitizeNicheVisit(value: unknown): NicheVisit {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const tracking: NicheVisit = {};
  for (const key of [...NICHE_TRACKING_KEYS, ...NICHE_PASSTHROUGH_KEYS]) {
    const raw = source[key];
    if (typeof raw === 'string') assignKey(tracking, key, raw.trim());
  }
  return tracking;
}

function readStoredVisit(): NicheVisit {
  try {
    if (typeof sessionStorage === 'undefined') return memoryVisit;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryVisit;
    return sanitizeNicheVisit(JSON.parse(raw));
  } catch {
    return memoryVisit;
  }
}

function writeStoredVisit(visit: NicheVisit) {
  memoryVisit = visit;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(visit));
  } catch {
    // Storage blocked. The in-memory copy still covers this page view,
    // and the redirect URL carries the same values to the next page.
  }
}

/**
 * URL values win over an earlier page in the same tab.
 * If storage throws, the merged visit is still returned.
 */
export function captureVisitAttribution(current: NicheVisit): NicheVisit {
  const merged: NicheVisit = { ...readStoredVisit(), ...sanitizeNicheVisit(current) };
  writeStoredVisit(merged);
  return merged;
}

export function withNicheTracking(pathname: string, tracking: NicheVisit): string {
  const [path, existing] = pathname.split('?');
  const params = new URLSearchParams(existing ?? '');
  for (const key of [...NICHE_TRACKING_KEYS, ...NICHE_PASSTHROUGH_KEYS]) {
    const value = tracking[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

const VARIANTS = ['c1', 'c2', 'c3'] as const;

/**
 * Match utm_content on its start, ignoring capitals.
 * Also accept the code as its own segment, so roof-c1-first-to-call matches c1.
 * The first matching segment wins when the value does not start with a code.
 */
export function headlineVariantFromUtm(value: string | undefined | null): HeadlineVariant {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return 'default';
  for (const variant of VARIANTS) {
    if (raw.startsWith(variant)) return variant;
  }
  const segments = raw.split(/[^a-z0-9]+/).filter(Boolean);
  for (const segment of segments) {
    if (segment === 'c1' || segment === 'c2' || segment === 'c3') return segment;
  }
  return 'default';
}

export function isHeadlineVariant(value: string | undefined | null): value is HeadlineVariant {
  return value === 'default' || value === 'c1' || value === 'c2' || value === 'c3';
}
