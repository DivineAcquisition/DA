/**
 * The machine doors, as the surfaces see them.
 *
 * These mirror the ingest_* tables. They are hand-written rather than generated
 * because the ingestion migrations are ahead of the checked-in Database types,
 * the same position the control-plane RPCs are in.
 */

export type IngestProvider = 'gohighlevel' | 'payments';

export type IngestAuthMode = 'shared_secret' | 'hmac_sha256';

/**
 * `received` is the only transient state. Everything else stands until an admin
 * replays it, which is what makes the queue a queue rather than a log to scroll.
 */
export type IngestStatus = 'received' | 'processed' | 'unattributed' | 'unknown_type' | 'failed';

export type IngestEndpoint = {
  id: string;
  provider: IngestProvider;
  key: string;
  auth_mode: IngestAuthMode;
  label: string;
  case_file_id: string | null;
  active: boolean;
  last_event_at: string | null;
  rotated_at: string | null;
  created_at: string;
};

export type IngestSource = {
  id: string;
  provider: IngestProvider;
  account_ref: string;
  case_file_id: string;
  label: string | null;
  created_at: string;
};

export type IngestEventTypeRow = {
  provider: IngestProvider;
  event_type: string;
  handler: string;
  description: string;
};

export type IngestEvent = {
  id: string;
  provider: IngestProvider;
  endpoint_id: string | null;
  dedupe_key: string;
  external_event_id: string | null;
  raw_body: string;
  payload: unknown;
  event_type: string | null;
  account_ref: string | null;
  case_file_id: string | null;
  status: IngestStatus;
  handler: string | null;
  error: string | null;
  attempts: number;
  received_at: string;
  processed_at: string | null;
  replayed_at: string | null;
};

export type IngestHealthRow = {
  provider: IngestProvider;
  endpoint_id: string | null;
  endpoint_label: string | null;
  case_file_id: string | null;
  client_name: string | null;
  events: number;
  processed: number;
  awaiting: number;
  unattributed: number;
  unknown_type: number;
  failed: number;
  last_received_at: string | null;
  last_processed_at: string | null;
};

export type IngestAuthFailure = {
  id: number;
  at: string;
  provider: IngestProvider | null;
  endpoint_key: string | null;
  reason: string;
  body_bytes: number | null;
};

/**
 * What rollup() returns. There is deliberately no shape here that carries the
 * payload without the freshness beside it: a caller cannot render a cached
 * number without having been told how old it is.
 */
export type RollupEnvelope<T> = {
  key: string;
  payload: T | null;
  computed_at: string | null;
  fresh_for_seconds: number | null;
  age_seconds: number | null;
  stale: boolean;
  never_computed: boolean;
  last_error: string | null;
  last_error_at: string | null;
};

export type CrossClientRow = {
  case_file_id: string;
  name: string;
  slug: string;
  status: string;
  leads: number;
  leads_answered: number;
  avg_response_minutes: number | null;
  response_compliance: number | null;
  bookings_credited: number;
  claims_pending: number;
  revenue_collected: number;
  invoiced_outstanding: number;
  last_ingest_at: string | null;
  ingest_needs_attention: number;
};

export type CrossClientRollup = {
  window_days: number;
  clients: CrossClientRow[];
  totals: {
    clients: number;
    leads: number;
    bookings_credited: number;
    claims_pending: number;
    revenue_collected: number;
    invoiced_outstanding: number;
    ingest_needs_attention: number;
    response_compliance: number | null;
  };
};
