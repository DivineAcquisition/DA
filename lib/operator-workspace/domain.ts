/**
 * The operator workspace address. Links, redirects, and emails use the
 * database setting. This module only knows how to read and apply it.
 * Hosting, DNS, and the auth redirect allow-list stay outside the app.
 */

import { appHosts, appUrl } from '../apps';

export type OperatorWorkspaceDomain = {
  /** Canonical origin, no trailing slash. Emails and new links use this. */
  origin: string;
  /** Extra origins that also serve the operator workspace during a changeover. */
  alsoActive: string[];
  /** Origins that redirect to the canonical one. */
  retired: string[];
};

export type HostRole = 'canonical' | 'active' | 'retired' | 'other';

/** A host or origin, reduced to https://host with no path and no trailing slash. */
export function cleanOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '') ?? '';
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!url.hostname || url.username || url.password || (url.pathname && url.pathname !== '/')) return null;
  return `${url.protocol}//${url.host}`.toLowerCase();
}

export function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function uniqueOrigins(values: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const value of values ?? []) {
    const origin = cleanOrigin(value);
    if (origin && !out.includes(origin)) out.push(origin);
  }
  return out;
}

export function normalizeDomain(input: {
  origin: string | null | undefined;
  alsoActive?: string[] | null;
  retired?: string[] | null;
}): OperatorWorkspaceDomain {
  const origin = cleanOrigin(input.origin) ?? '';
  const retired = uniqueOrigins(input.retired).filter((item) => item !== origin);
  const alsoActive = uniqueOrigins(input.alsoActive).filter((item) => item !== origin && !retired.includes(item));
  return { origin, alsoActive, retired };
}

/** Retired wins over an env host that has not been removed yet. */
export function hostRole(host: string, domain: OperatorWorkspaceDomain): HostRole {
  const name = host.toLowerCase().split(':')[0];
  if (!name || !domain.origin) return 'other';
  if (hostOf(domain.origin) === name) return 'canonical';
  if (domain.retired.some((origin) => hostOf(origin) === name)) return 'retired';
  if (domain.alsoActive.some((origin) => hostOf(origin) === name)) return 'active';
  return 'other';
}

/** Hosts that serve the operator workspace. Retired hosts are left out. */
export function servingHosts(domain: OperatorWorkspaceDomain, extra: string[] = []): string[] {
  const retired = new Set(domain.retired.map(hostOf));
  const hosts = [domain.origin, ...domain.alsoActive, ...extra]
    .map((value) => hostOf(value.includes('://') ? value : `https://${value}`))
    .filter((host) => host && !retired.has(host));
  return [...new Set(hosts)];
}

export function fallbackDomain(env: Record<string, string | undefined> = process.env): OperatorWorkspaceDomain {
  const origin = appUrl('team', env);
  const extra = appHosts('team', env)
    .filter((host) => host !== hostOf(origin))
    .map((host) => `https://${host}`);
  return normalizeDomain({ origin, alsoActive: extra, retired: [] });
}

type Cache = { at: number; domain: OperatorWorkspaceDomain };
let cache: Cache | null = null;
const CACHE_MS = 30_000;

export function clearOperatorWorkspaceCache(): void {
  cache = null;
}

/**
 * The setting, cached briefly. When the database cannot be read, the env
 * address (or the bootstrap address) keeps the current host working.
 */
export async function loadOperatorWorkspaceDomain(
  env: Record<string, string | undefined> = process.env,
): Promise<OperatorWorkspaceDomain> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.domain;
  const fallback = fallbackDomain(env);
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
  if (!supabaseUrl || !key) return fallback;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/so_operator_workspace_hosts`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      cache: 'no-store',
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as { origin?: string; also_active?: string[]; retired?: string[] } | null;
    const domain = normalizeDomain({
      origin: data?.origin,
      alsoActive: data?.also_active,
      retired: data?.retired,
    });
    if (!domain.origin) return fallback;
    cache = { at: Date.now(), domain };
    return domain;
  } catch {
    return fallback;
  }
}
