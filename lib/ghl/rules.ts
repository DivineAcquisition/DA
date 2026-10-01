/**
 * The parts of the GHL request layer that are pure: how a response is read,
 * how long to wait, what may be logged. Kept apart from the network code so
 * they can be tested without GHL.
 *
 * Confirmed against GHL's documentation (marketplace.gohighlevel.com):
 *   base URL         https://services.leadconnectorhq.com
 *   headers          Authorization: Bearer <token>, Version: 2021-07-28
 *   rate limits      100 requests per 10 seconds burst and 200,000 per day,
 *                    per location or company, reported in X-RateLimit-* headers
 */

export const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
export const GHL_API_VERSION = '2021-07-28';

export type Outcome =
  | 'ok'
  | 'rate_limited'
  | 'auth_failed'
  | 'scope_missing'
  | 'not_found'
  | 'client_error'
  | 'server_error'
  | 'network';

/** What a status code and body mean for the caller. */
export function classifyOutcome(status: number | null, body: unknown): Outcome {
  if (status === null) return 'network';
  if (status >= 200 && status < 300) return 'ok';
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) {
    // GHL answers a token that lacks a scope with "The token is not authorized
    // for this scope." A token that is wrong, revoked or expired gets a plain 401.
    return /scope/i.test(bodyText(body)) ? 'scope_missing' : 'auth_failed';
  }
  if (status === 404) return 'not_found';
  if (status >= 500) return 'server_error';
  return 'client_error';
}

export function bodyText(body: unknown): string {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  if (typeof body === 'object') {
    const value = body as Record<string, unknown>;
    const message = value.message ?? value.error ?? value.msg;
    if (Array.isArray(message)) return message.map(String).join('; ');
    if (message != null) return String(message);
  }
  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
}

/** Temporary failures worth another try. Auth and scope failures never are. */
export function isRetryable(outcome: Outcome): boolean {
  return outcome === 'rate_limited' || outcome === 'server_error' || outcome === 'network';
}

/**
 * How long to wait before the next attempt. A rate limit honours Retry-After or
 * the interval GHL reports; anything else backs off exponentially with jitter.
 */
export function backoffMs(attempt: number, headers?: { get(name: string): string | null } | null, random = Math.random): number {
  const retryAfter = headers?.get('retry-after');
  if (retryAfter && /^\d+(\.\d+)?$/.test(retryAfter.trim())) {
    return Math.min(Number(retryAfter) * 1000, 30_000);
  }
  const interval = headers?.get('x-ratelimit-interval-milliseconds');
  const remaining = headers?.get('x-ratelimit-remaining');
  if (interval && remaining === '0' && /^\d+$/.test(interval)) {
    return Math.min(Number(interval), 30_000);
  }
  const base = 500 * 2 ** Math.max(0, attempt - 1);
  return Math.min(base + Math.floor(random() * 250), 15_000);
}

/** Wait before a call when the burst window is nearly spent. */
export function throttleMs(remaining: number | null, intervalMs: number | null): number {
  if (remaining === null || remaining > 5) return 0;
  return Math.min(Math.max(intervalMs ?? 10_000, 0), 10_000);
}

export function headerNumber(headers: { get(name: string): string | null }, name: string): number | null {
  const value = headers.get(name);
  return value && /^\d+$/.test(value.trim()) ? Number(value) : null;
}

/** Ids are fine to log; free text, emails and anything token-shaped are not. */
const LOGGABLE_QUERY = new Set(['locationId', 'companyId', 'limit', 'sortBy', 'sort', 'type', 'skip']);

export function loggablePath(path: string, query?: Record<string, string | number | undefined>): string {
  const clean = path.split('?')[0];
  const params = Object.entries(query ?? {})
    .filter(([key, value]) => value !== undefined && LOGGABLE_QUERY.has(key))
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return params.length ? `${clean}?${params.join('&')}` : clean;
}

/**
 * Strip anything that could be a credential from a message before it is stored
 * or shown: bearer values, Private Integration Tokens, JWTs, long hex or base64
 * runs, and the exact token when the caller knows it.
 */
export function redact(text: string, secrets: string[] = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) out = out.split(secret).join('[redacted]');
  }
  return out
    .replace(/Bearer\s+[^\s"',]+/gi, 'Bearer [redacted]')
    .replace(/\bpit-[A-Za-z0-9-]{8,}/g, '[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, '[redacted]')
    .replace(/\b[a-f0-9]{32,}\b/gi, '[redacted]')
    .slice(0, 500);
}

export function last4(token: string): string {
  return token.trim().slice(-4);
}

// ---------------------------------------------------------------------------
// Scope probes
//
// A Private Integration Token cannot be asked which scopes it holds. Each scope
// is probed with the cheapest call it governs. A write scope is probed against
// an id that cannot exist, so nothing is changed: GHL checks the scope before
// it looks the record up, and answers a missing one with "not authorized for
// this scope", while a held one gets 400, 404 or 422.
// ---------------------------------------------------------------------------

export type Probe = { scope: string; method: 'GET' | 'PUT'; path: string; query?: Record<string, string>; body?: unknown };

export const PROBE_ID = 'da-scope-probe-000000000000';

export function locationProbes(locationId: string): Probe[] {
  return [
    { scope: 'locations.readonly', method: 'GET', path: `/locations/${locationId}` },
    { scope: 'users.readonly', method: 'GET', path: '/users/', query: { locationId } },
    { scope: 'contacts.readonly', method: 'GET', path: '/contacts/', query: { locationId, limit: '1' } },
    { scope: 'contacts.write', method: 'PUT', path: `/contacts/${PROBE_ID}`, body: {} },
    { scope: 'conversations.readonly', method: 'GET', path: '/conversations/search', query: { locationId, limit: '1' } },
    { scope: 'conversations/message.readonly', method: 'GET', path: `/conversations/${PROBE_ID}/messages` },
    { scope: 'opportunities.readonly', method: 'GET', path: '/opportunities/pipelines', query: { locationId } },
    { scope: 'calendars.readonly', method: 'GET', path: '/calendars/', query: { locationId } },
    { scope: 'locations/customFields.readonly', method: 'GET', path: `/locations/${locationId}/customFields` },
    { scope: 'locations/tags.readonly', method: 'GET', path: `/locations/${locationId}/tags` },
  ];
}

export function agencyProbes(companyId: string): Probe[] {
  return [
    { scope: 'locations.readonly', method: 'GET', path: '/locations/search', query: { companyId, limit: '1' } },
    { scope: 'users.readonly', method: 'GET', path: '/users/search', query: { companyId, limit: '1' } },
    { scope: 'users.write', method: 'PUT', path: `/users/${PROBE_ID}`, body: {} },
  ];
}

/** Whether a probe's outcome means the scope is held. */
export function scopeHeld(outcome: Outcome): boolean | null {
  if (outcome === 'scope_missing' || outcome === 'auth_failed') return false;
  if (outcome === 'ok' || outcome === 'not_found' || outcome === 'client_error') return true;
  return null; // rate limited, server or network: unknown, not counted either way
}

// ---------------------------------------------------------------------------
// Shapes GHL returns, reduced to what the database functions take
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

function arr(value: unknown): Json[] {
  return Array.isArray(value) ? (value.filter((x) => x && typeof x === 'object') as Json[]) : [];
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : typeof value === 'number' ? String(value) : null;
}

export type FoundShape = {
  pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[];
  customFields: { id: string; name: string; dataType: string | null }[];
  tags: { id: string; name: string }[];
  calendars: { id: string; name: string }[];
};

export function readShape(pipelines: unknown, customFields: unknown, tags: unknown, calendars: unknown): FoundShape {
  return {
    pipelines: arr((pipelines as Json)?.pipelines).map((p) => ({
      id: str(p.id) ?? '',
      name: str(p.name) ?? '',
      // GHL lists stages in their order in the pipeline; the array order is the position.
      stages: arr(p.stages).map((s) => ({ id: str(s.id) ?? '', name: str(s.name) ?? '' })),
    })),
    customFields: arr((customFields as Json)?.customFields).map((f) => ({
      id: str(f.id) ?? '',
      name: str(f.name) ?? '',
      dataType: str(f.dataType),
    })),
    tags: arr((tags as Json)?.tags).map((t) => ({ id: str(t.id) ?? '', name: str(t.name) ?? '' })),
    calendars: arr((calendars as Json)?.calendars).map((c) => ({ id: str(c.id) ?? '', name: str(c.name) ?? '' })),
  };
}

export type GhlUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  type: string | null;
  locationIds: string[];
  permissions: Record<string, unknown> | null;
};

export function readUser(raw: unknown): GhlUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Json;
  const roles = (u.roles ?? {}) as Json;
  const id = str(u.id);
  if (!id) return null;
  const name = str(u.name) ?? ([str(u.firstName), str(u.lastName)].filter(Boolean).join(' ') || null);
  return {
    id,
    name,
    email: str(u.email)?.toLowerCase() ?? null,
    role: str(roles.role) ?? str(u.role),
    type: str(roles.type) ?? str(u.type),
    locationIds: (Array.isArray(roles.locationIds) ? roles.locationIds : Array.isArray(u.locationIds) ? u.locationIds : [])
      .map(String),
    permissions: u.permissions && typeof u.permissions === 'object' ? (u.permissions as Record<string, unknown>) : null,
  };
}

export function readUsers(body: unknown): GhlUser[] {
  return arr((body as Json)?.users).map(readUser).filter((u): u is GhlUser => u !== null);
}

/**
 * A conversation message, reduced to the event the ingestion handlers read.
 * userId and source are what tell a human from an automation (see
 * app.ghl_classify_touch). No body text is kept: the handlers never need it.
 */
export type PolledEvent = {
  type: 'InboundMessage' | 'OutboundMessage';
  messageId: string;
  contactId: string | null;
  conversationId: string | null;
  userId: string | null;
  source: string | null;
  messageType: string | null;
  direction: string;
  dateAdded: string;
};

export function readMessages(body: unknown, conversationId: string, contactId: string | null): PolledEvent[] {
  const outer = (body as Json)?.messages;
  const list = Array.isArray(outer) ? arr(outer) : arr((outer as Json)?.messages);
  return list
    .map((m): PolledEvent | null => {
      const id = str(m.id);
      const date = str(m.dateAdded);
      const direction = (str(m.direction) ?? '').toLowerCase();
      if (!id || !date || (direction !== 'inbound' && direction !== 'outbound')) return null;
      return {
        type: direction === 'inbound' ? 'InboundMessage' : 'OutboundMessage',
        messageId: id,
        contactId: str(m.contactId) ?? contactId,
        conversationId: str(m.conversationId) ?? conversationId,
        userId: str(m.userId),
        source: str(m.source),
        messageType: str(m.messageType) ?? str(m.type),
        direction,
        dateAdded: date,
      };
    })
    .filter((e): e is PolledEvent => e !== null);
}

// ---------------------------------------------------------------------------
// Provisioning helpers
// ---------------------------------------------------------------------------

/** Every flag in a profile, turned off: what "deactivate" sends. */
export function allOff(permissions: Record<string, unknown>): Record<string, boolean> {
  return Object.fromEntries(Object.keys(permissions).map((key) => [key, false]));
}

export function withLocation(current: string[], locationId: string): string[] {
  return current.includes(locationId) ? current : [...current, locationId];
}

export function withoutLocations(current: string[], remove: string[]): string[] {
  const drop = new Set(remove);
  return current.filter((id) => !drop.has(id));
}

/** Flags in the profile that the user's permissions do not match. */
export function permissionDiff(want: Record<string, unknown>, has: Record<string, unknown> | null): string[] {
  return Object.entries(want)
    .filter(([key, value]) => {
      const current = has?.[key];
      if (current === undefined && value === false) return false;
      return current !== value;
    })
    .map(([key]) => key);
}

export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] || 'DA', lastName: 'VA' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/** Where a VA lands in GHL. White-labelled agencies set their own app domain. */
export function ghlAppUrl(base: string, locationId: string, contactId?: string | null): string {
  const root = base.replace(/\/+$/, '');
  return contactId
    ? `${root}/v2/location/${encodeURIComponent(locationId)}/contacts/detail/${encodeURIComponent(contactId)}`
    : `${root}/v2/location/${encodeURIComponent(locationId)}/dashboard`;
}
