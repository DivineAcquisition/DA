import { controlRpc } from '@/lib/ad/rpc';
import { createClient, isAdminSession } from '@/lib/supabase/server';
import type {
  CrossClientRollup,
  IngestAuthFailure,
  IngestEndpoint,
  IngestEvent,
  IngestEventTypeRow,
  IngestHealthRow,
  IngestSource,
  RollupEnvelope,
} from './types';

/**
 * Reads for the ingestion surface.
 *
 * RLS is the boundary, so these are plain queries — a manager's session returns
 * their scope and a client's returns nothing. The admin check here only keeps a
 * refusal from surfacing as a server error on a page nobody is going to see,
 * which is the same reason the other surfaces have one.
 *
 * The ingest_* tables and rollup() are ahead of the generated Database types, so
 * these go through the untyped accessors the control plane already established.
 */

/**
 * The ingest_* tables are ahead of the generated Database types, so they are
 * reached through this shape: the slice of the query builder these reads use,
 * still chainable and still awaitable, without claiming to know the row types.
 */
type UntypedQuery = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select: (columns: string) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => UntypedQuery;
  limit: (count: number) => UntypedQuery;
  eq: (column: string, value: string) => UntypedQuery;
  in: (column: string, values: string[]) => UntypedQuery;
};

const untyped = (client: unknown) =>
  client as unknown as { from: (table: string) => UntypedQuery };

export async function listIngestEndpoints(): Promise<
  (IngestEndpoint & { client_name: string | null })[]
> {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();

  const { data, error } = await untyped(supabase)
    .from('ingest_endpoint')
    .select(
      'id, provider, key, auth_mode, label, case_file_id, active, last_event_at, rotated_at, created_at, client_case_file(name)',
    )
    .order('provider')
    .order('label');

  if (error) {
    console.error('listIngestEndpoints', error.message);
    return [];
  }

  return ((data ?? []) as (IngestEndpoint & { client_case_file: { name: string } | null })[]).map(
    ({ client_case_file, ...endpoint }) => ({
      ...endpoint,
      client_name: client_case_file?.name ?? null,
    }),
  );
}

export async function getIngestHealth(): Promise<IngestHealthRow[]> {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();

  const { data, error } = await untyped(supabase)
    .from('v_ingest_health')
    .select('*')
    .order('last_received_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('getIngestHealth', error.message);
    return [];
  }
  return (data ?? []) as IngestHealthRow[];
}

/**
 * The queue. Everything the pipeline could not finish, which is the whole point
 * of storing an unattributable or unhandled delivery rather than dropping it.
 */
export async function listEventsNeedingAttention(limit = 100): Promise<IngestEvent[]> {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();

  const { data, error } = await untyped(supabase)
    .from('ingest_event')
    .select(
      'id, provider, endpoint_id, dedupe_key, external_event_id, raw_body, payload, event_type, account_ref, case_file_id, status, handler, error, attempts, received_at, processed_at, replayed_at',
    )
    .in('status', ['failed', 'unattributed', 'unknown_type'])
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('listEventsNeedingAttention', error.message);
    return [];
  }
  return (data ?? []) as IngestEvent[];
}

export async function listRecentEvents(limit = 50, caseFileId?: string): Promise<IngestEvent[]> {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();

  let query = untyped(supabase)
    .from('ingest_event')
    .select(
      'id, provider, endpoint_id, dedupe_key, external_event_id, raw_body, payload, event_type, account_ref, case_file_id, status, handler, error, attempts, received_at, processed_at, replayed_at',
    )
    .order('received_at', { ascending: false })
    .limit(limit);

  if (caseFileId) query = query.eq('case_file_id', caseFileId);

  const { data, error } = await query;
  if (error) {
    console.error('listRecentEvents', error.message);
    return [];
  }
  return (data ?? []) as IngestEvent[];
}

export async function listIngestSources(): Promise<(IngestSource & { client_name: string | null })[]> {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();

  const { data, error } = await untyped(supabase)
    .from('ingest_source')
    .select('id, provider, account_ref, case_file_id, label, created_at, client_case_file(name)')
    .order('provider')
    .order('account_ref');

  if (error) {
    console.error('listIngestSources', error.message);
    return [];
  }

  return ((data ?? []) as (IngestSource & { client_case_file: { name: string } | null })[]).map(
    ({ client_case_file, ...source }) => ({ ...source, client_name: client_case_file?.name ?? null }),
  );
}

export async function listIngestEventTypes(): Promise<IngestEventTypeRow[]> {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();

  const { data, error } = await untyped(supabase)
    .from('ingest_event_type')
    .select('provider, event_type, handler, description')
    .order('provider')
    .order('event_type');

  if (error) {
    console.error('listIngestEventTypes', error.message);
    return [];
  }
  return (data ?? []) as IngestEventTypeRow[];
}

export async function listAuthFailures(limit = 20): Promise<IngestAuthFailure[]> {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();

  const { data, error } = await untyped(supabase)
    .from('ingest_auth_failure')
    .select('id, at, provider, endpoint_key, reason, body_bytes')
    .order('at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('listAuthFailures', error.message);
    return [];
  }
  return (data ?? []) as IngestAuthFailure[];
}

/**
 * The cross-client rollup, inside its freshness envelope. Nothing here returns
 * the payload on its own, so a caller cannot render a cached figure without
 * having been handed its age.
 */
export async function getCrossClientRollup(): Promise<RollupEnvelope<CrossClientRollup> | null> {
  if (!(await isAdminSession())) return null;
  const supabase = await createClient();

  const { data, error } = await controlRpc<RollupEnvelope<CrossClientRollup>>(supabase, 'rollup', {
    p_key: 'cross_client',
  });

  if (error) {
    console.error('getCrossClientRollup', error.message);
    return null;
  }
  return data;
}

/** The clients an unattributed event could belong to. */
export async function listCaseFileOptions(): Promise<{ id: string; name: string }[]> {
  if (!(await isAdminSession())) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('client_case_file')
    .select('id, name')
    .order('name');

  if (error) {
    console.error('listCaseFileOptions', error.message);
    return [];
  }
  return data ?? [];
}
