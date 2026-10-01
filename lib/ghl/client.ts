import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  GHL_API_VERSION,
  GHL_BASE_URL,
  backoffMs,
  bodyText,
  classifyOutcome,
  headerNumber,
  isRetryable,
  loggablePath,
  redact,
  throttleMs,
  type Outcome,
} from './rules';

/**
 * The one way this app talks to GHL. Server only: nothing here may be imported
 * from a client component, and nothing it returns carries a token.
 *
 * Callers ask for "a working connection for this sub-account" (or the agency)
 * and get a session that can make requests. Which token, and whether it is a
 * Private Integration Token or (later) an OAuth access token, never leaves this
 * file. Every call is logged to ghl_request_log with its path, outcome, timing
 * and rate-limit headroom, and never with a token or a body.
 *
 * Prompt 10 adds actions by calling `session.request` with its own purposes;
 * retry, back-off, logging and redaction come with it.
 */

export type ServiceClient = SupabaseClient;

export function serviceClient(): ServiceClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
  if (!url || !key) return null;
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type GhlResponse<T = unknown> = {
  ok: boolean;
  status: number | null;
  outcome: Outcome;
  data: T | null;
  /** Safe to store and show: redacted. */
  error: string | null;
};

export type RequestOptions = {
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** What this call is for, in the log: "health check", "grant access", ... */
  purpose: string;
  /**
   * Whether a failed attempt may be repeated blindly. GET and PUT are safe; a
   * POST that creates something is not, and its caller checks for the record
   * before trying again.
   */
  retrySafe?: boolean;
  maxAttempts?: number;
  idempotencyKey?: string;
};

export type ConnectionInfo = {
  connectionId: string | null;
  level: 'agency' | 'location';
  locationId: string | null;
  companyId: string | null;
  caseFileId: string | null;
};

type RateState = { remaining: number | null; intervalMs: number | null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GhlSession {
  readonly info: ConnectionInfo;
  // Held only in memory for the life of this session.
  readonly #token: string;
  readonly #db: ServiceClient | null;
  readonly #rate: RateState = { remaining: null, intervalMs: null };

  constructor(info: ConnectionInfo, token: string, db: ServiceClient | null) {
    this.info = info;
    this.#token = token;
    this.#db = db;
  }

  async request<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, options: RequestOptions): Promise<GhlResponse<T>> {
    if (method === 'DELETE') {
      // Nothing in this app deletes anything in GHL. Deactivate, never delete.
      return { ok: false, status: null, outcome: 'client_error', data: null, error: 'DELETE is not allowed against GHL' };
    }
    const retrySafe = options.retrySafe ?? method !== 'POST';
    const maxAttempts = options.maxAttempts ?? (retrySafe ? 4 : 1);
    const url = new URL(path.startsWith('/') ? path : `/${path}`, GHL_BASE_URL);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let last: GhlResponse<T> = { ok: false, status: null, outcome: 'network', data: null, error: 'not attempted' };
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const wait = throttleMs(this.#rate.remaining, this.#rate.intervalMs);
      if (wait) await sleep(wait);

      const started = Date.now();
      let status: number | null = null;
      let body: unknown = null;
      let headers: Headers | null = null;
      try {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.#token}`,
            Version: GHL_API_VERSION,
            Accept: 'application/json',
            ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: AbortSignal.timeout(20_000),
          cache: 'no-store',
        });
        status = response.status;
        headers = response.headers;
        const text = await response.text();
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = text;
        }
      } catch (error) {
        body = error instanceof Error ? error.message : String(error);
      }

      const outcome = classifyOutcome(status, body);
      if (headers) {
        this.#rate.remaining = headerNumber(headers, 'x-ratelimit-remaining');
        this.#rate.intervalMs = headerNumber(headers, 'x-ratelimit-interval-milliseconds');
      }
      const error = outcome === 'ok' ? null : redact(`${status ?? 'network'}: ${bodyText(body) || 'no detail'}`, [this.#token]);
      last = { ok: outcome === 'ok', status, outcome, data: outcome === 'ok' ? (body as T) : null, error };

      await this.#log({
        method,
        path: loggablePath(url.pathname, options.query),
        purpose: options.purpose,
        attempt,
        status,
        outcome,
        duration: Date.now() - started,
        burst: headers ? headerNumber(headers, 'x-ratelimit-remaining') : null,
        daily: headers ? headerNumber(headers, 'x-ratelimit-daily-remaining') : null,
        idempotencyKey: options.idempotencyKey ?? null,
        error,
      });

      if (outcome === 'ok' || !isRetryable(outcome) || attempt === maxAttempts) break;
      // A rate limit is always safe to wait out; the request was refused, not run.
      if (!retrySafe && outcome !== 'rate_limited') break;
      await sleep(backoffMs(attempt, headers));
    }
    return last;
  }

  async #log(row: {
    method: string;
    path: string;
    purpose: string;
    attempt: number;
    status: number | null;
    outcome: Outcome;
    duration: number;
    burst: number | null;
    daily: number | null;
    idempotencyKey: string | null;
    error: string | null;
  }) {
    if (!this.#db) return;
    await this.#db.from('ghl_request_log').insert({
      connection_id: this.info.connectionId,
      case_file_id: this.info.caseFileId,
      method: row.method,
      path: row.path,
      purpose: row.purpose,
      attempt: row.attempt,
      status_code: row.status,
      outcome: row.outcome,
      duration_ms: row.duration,
      burst_remaining: row.burst,
      daily_remaining: row.daily,
      idempotency_key: row.idempotencyKey,
      error: row.error,
    });
  }
}

export type Pick = { ok: true; session: GhlSession } | { ok: false; reason: string; locationId?: string | null };

/**
 * A working connection for a client's sub-account ('location'), for the agency
 * ('agency'), or a specific connection by id for a health check ('check').
 */
export async function connect(
  db: ServiceClient,
  target: { caseFileId?: string | null; purpose: 'location' | 'agency' | 'check'; connectionId?: string },
): Promise<Pick> {
  const { data: pick, error } = await db.rpc('ghl_pick_connection', {
    p_case_file_id: target.caseFileId ?? null,
    p_purpose: target.purpose,
    p_connection_id: target.connectionId ?? null,
  });
  if (error) return { ok: false, reason: error.message };
  const p = pick as Record<string, unknown>;
  if (!p?.ok) return { ok: false, reason: String(p?.reason ?? 'no_connection'), locationId: (p?.location_id as string) ?? null };

  const { data: token, error: tokenError } = await db.rpc('ghl_connection_secret', { p_connection_id: p.connection_id });
  if (tokenError || typeof token !== 'string' || !token) return { ok: false, reason: 'token_unavailable' };

  return {
    ok: true,
    session: new GhlSession(
      {
        connectionId: String(p.connection_id),
        level: p.level === 'agency' ? 'agency' : 'location',
        locationId: (p.location_id as string) ?? null,
        companyId: (p.company_id as string) ?? null,
        caseFileId: (p.case_file_id as string) ?? target.caseFileId ?? null,
      },
      token,
      db,
    ),
  };
}

/**
 * A session over a token that has not been stored yet, for the test that runs
 * before saving. Calls are logged without a connection id.
 */
export function unsavedSession(
  token: string,
  info: Omit<ConnectionInfo, 'connectionId'>,
  db: ServiceClient | null,
): GhlSession {
  return new GhlSession({ ...info, connectionId: null }, token, db);
}
