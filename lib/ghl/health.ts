import type { GhlSession } from './client';
import { agencyProbes, locationProbes, readShape, readUsers, scopeHeld, type FoundShape, type GhlUser } from './rules';

export type HealthResult = {
  ok: boolean;
  authFailed: boolean;
  error: string | null;
  present: string[];
  missing: string[];
  companyId: string | null;
  locationName: string | null;
  locationTimeZone: string | null;
};

/**
 * Test a connection: the base call must succeed (a wrong or revoked token
 * fails here), then each required scope is probed. Used before a token is
 * saved, after it is saved, on schedule and on demand.
 */
export async function checkSession(session: GhlSession): Promise<HealthResult> {
  const { level, locationId, companyId } = session.info;
  const result: HealthResult = {
    ok: false,
    authFailed: false,
    error: null,
    present: [],
    missing: [],
    companyId,
    locationName: null,
    locationTimeZone: null,
  };

  if (level === 'location') {
    if (!locationId) return { ...result, error: 'No Location ID' };
    const base = await session.request<{ location?: Record<string, unknown> }>('GET', `/locations/${locationId}`, { purpose: 'health check' });
    if (!base.ok) {
      return { ...result, authFailed: base.outcome === 'auth_failed', error: describe(base.outcome, base.error) };
    }
    const location = base.data?.location ?? {};
    result.locationName = typeof location.name === 'string' ? location.name : null;
    result.locationTimeZone = typeof location.timezone === 'string' ? location.timezone : null;
    result.companyId = typeof location.companyId === 'string' ? location.companyId : companyId;
  } else {
    if (!companyId) return { ...result, error: 'The agency connection needs its Company ID' };
    const base = await session.request('GET', '/locations/search', { query: { companyId, limit: 1 }, purpose: 'health check' });
    if (!base.ok && base.outcome !== 'scope_missing') {
      return { ...result, authFailed: base.outcome === 'auth_failed', error: describe(base.outcome, base.error) };
    }
  }

  const probes = level === 'location' ? locationProbes(locationId!) : agencyProbes(companyId!);
  for (const probe of probes) {
    const response = await session.request(probe.method, probe.path, {
      query: probe.query,
      body: probe.body,
      purpose: `scope check: ${probe.scope}`,
      retrySafe: true,
      maxAttempts: 2,
    });
    const held = scopeHeld(response.outcome);
    if (held === true) result.present.push(probe.scope);
    else if (held === false) result.missing.push(probe.scope);
  }
  result.ok = true;
  return result;
}

function describe(outcome: string, error: string | null): string {
  if (outcome === 'auth_failed') return `GHL refused the token (${error ?? 'unauthorised'}). It is wrong, revoked or expired.`;
  if (outcome === 'not_found') return `GHL does not know that Location ID (${error ?? '404'}).`;
  if (outcome === 'scope_missing') return `The token lacks the scope for this check (${error ?? ''}).`;
  return error ?? outcome;
}

/** The sub-account's pipelines, fields, tags and calendars, for mapping. */
export async function readLocationShape(session: GhlSession): Promise<{ ok: true; shape: FoundShape } | { ok: false; error: string }> {
  const locationId = session.info.locationId!;
  const [pipelines, fields, tags, calendars] = [
    await session.request('GET', '/opportunities/pipelines', { query: { locationId }, purpose: 'mapping' }),
    await session.request('GET', `/locations/${locationId}/customFields`, { purpose: 'mapping' }),
    await session.request('GET', `/locations/${locationId}/tags`, { purpose: 'mapping' }),
    await session.request('GET', '/calendars/', { query: { locationId }, purpose: 'mapping' }),
  ];
  const failed = [pipelines, fields, tags, calendars].find((r) => !r.ok);
  // A read that failed is not drift: mapping is skipped rather than recorded
  // as everything missing.
  if (failed) return { ok: false, error: failed.error ?? failed.outcome };
  return { ok: true, shape: readShape(pipelines.data, fields.data, tags.data, calendars.data) };
}

export async function readLocationUsers(session: GhlSession): Promise<{ ok: true; users: GhlUser[] } | { ok: false; error: string }> {
  const response = await session.request('GET', '/users/', { query: { locationId: session.info.locationId! }, purpose: 'reconciliation' });
  if (!response.ok) return { ok: false, error: response.error ?? response.outcome };
  return { ok: true, users: readUsers(response.data) };
}
