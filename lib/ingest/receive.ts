import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase/server';
import type { IngestProvider } from './types';
import type { Credential } from './rules/providers';

/**
 * The two calls behind a machine door.
 *
 * A webhook arrives with no session, so this client carries no cookies and no
 * user. ingest_receive() and ingest_process() are granted to anon for exactly
 * that reason, the same as attempt_sign_in(): the door's secret is what
 * authorises the request, and both functions verify it themselves rather than
 * trusting anything about the caller.
 */

/**
 * ingest_receive and ingest_process are ahead of the generated Database types,
 * like the control-plane RPCs, so they are reached through this shape rather
 * than the typed client.
 */
type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function sessionless(): RpcClient {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as RpcClient;
}

export type ReceiveOutcome =
  | { ok: false; reason: 'unauthorised' }
  | {
      ok: true;
      eventId: string;
      duplicate: boolean;
      status: string;
      /** Null for a duplicate or an unparseable body: there is nothing to process. */
      processToken: string | null;
    };

type ReceiveResponse = {
  ok: boolean;
  reason?: string;
  event_id: string;
  duplicate: boolean;
  status: string;
  process_token: string | null;
};

export async function receiveDelivery(input: {
  endpointKey: string;
  body: string;
  credential: Credential;
  headers: Record<string, string>;
  ip: string | null;
  userAgent: string | null;
}): Promise<ReceiveOutcome> {
  const supabase = sessionless();

  const { data, error } = await supabase.rpc('ingest_receive', {
    p_endpoint_key: input.endpointKey,
    p_body: input.body,
    p_secret: input.credential.secret,
    p_signature: input.credential.signature,
    p_signed_at: input.credential.signedAt,
    p_headers: input.headers,
    p_ip: input.ip,
    p_user_agent: input.userAgent,
  });

  // A refusal comes back as a value rather than an error, so the row recording it
  // survives. An actual error here means the database could not be reached, which
  // must not be reported to the provider as success or it will never retry.
  if (error) throw new Error(error.message);

  const response = data as ReceiveResponse | null;
  if (!response || response.ok === false) return { ok: false, reason: 'unauthorised' };

  return {
    ok: true,
    eventId: response.event_id,
    duplicate: response.duplicate,
    status: response.status,
    processToken: response.process_token,
  };
}

export async function processDelivery(eventId: string, processToken: string): Promise<void> {
  const supabase = sessionless();

  const { error } = await supabase.rpc('ingest_process', {
    p_event_id: eventId,
    p_process_token: processToken,
  });

  // Nothing is lost by a failure here. The delivery is already logged, and cron
  // drains anything left queued, so this only ever costs a minute of delay.
  if (error) console.error('ingest_process', eventId, error.message);
}

export function providerSlug(provider: IngestProvider): string {
  return provider === 'gohighlevel' ? 'ghl' : 'payments';
}
