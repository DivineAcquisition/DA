/** Shapes the ghl_* read functions return. Never a token: only its last four. */

export type Health = 'untested' | 'healthy' | 'degraded' | 'failing' | 'retired';

export type Connection = {
  id: string;
  level: 'agency' | 'location';
  label: string;
  auth_kind: string;
  last4: string;
  location_id: string | null;
  company_id: string | null;
  status: Health;
  scopes_present: string[];
  scopes_missing: string[];
  last_checked_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  paused_reason: string | null;
  token_created_on: string;
  rotation_interval_days: number;
  rotation_due_on: string;
  next_check_at: string;
  check_requested: boolean;
  candidate: { id: string; last4: string; status: Health; created_at: string } | null;
};

export type ReadinessCheck = { key: string; label: string; ok: boolean; blocking: boolean; detail: string };
export type Readiness = { ready: boolean; checks: ReadinessCheck[] };

export type Overview = {
  can_manage: boolean;
  agency: Connection | null;
  required_scopes: { agency: string[]; location: string[] };
  clients: {
    case_file_id: string;
    name: string;
    status: string;
    location_id: string | null;
    location_name: string | null;
    is_test: boolean;
    connection: Connection | null;
    readiness: Readiness;
    drift: number;
    endpoint: boolean;
    last_event_at: string | null;
    open_mismatches: number;
    pending_access: number;
  }[];
};

export type Routing = {
  case_file_id: string;
  enabled: boolean;
  routing_method: 'round_robin' | 'single_owner' | 'manual';
  single_owner_placement_id: string | null;
  after_hours_behavior: 'next_shift' | 'manual';
  remind_after_minutes: number;
  manager_after_minutes: number;
  max_open_leads: number;
  auto_reassign: boolean;
  reassign_after_minutes: number;
  silence_alert_minutes: number;
};

export type CaseDetail = {
  case_file_id: string;
  name: string;
  can_manage: boolean;
  can_manage_access: boolean;
  can_manage_routing: boolean;
  location: {
    location_id: string;
    location_name: string | null;
    time_zone: string | null;
    is_test: boolean;
    mapping_checked_at: string | null;
    users_checked_at: string | null;
    polled_at: string | null;
    a2p_recorded_at: string | null;
    a2p_reference: string | null;
  } | null;
  connection: Connection | null;
  readiness: Readiness;
  mapping: { kind: string; name: string; parent: string | null; position: number | null; field_type: string | null; status: string; ghl_id: string | null; detail: string | null }[];
  endpoint: { id: string; path: string; active: boolean; last_event_at: string | null; rotated_at: string | null; header: string } | null;
  routing: Routing;
  access: {
    grant_id: string;
    profile_id: string;
    name: string;
    role: string;
    reason: string;
    state: string;
    ghl_user_id: string | null;
    granted_at: string | null;
    revoke_reason: string | null;
    last_error: string | null;
    verify_manually: string[];
  }[];
  ghl_users: { ghl_user_id: string; name: string | null; email: string | null; role: string | null; type: string | null; known_kind: string | null; created_by_app: boolean; da_person: string | null }[];
  mismatches: Mismatch[];
  changes: { at: string; action: string; outcome: string; detail: string | null; actor_label: string; person: string | null }[];
  requests: { at: string; method: string; path: string; purpose: string; status_code: number | null; outcome: string; duration_ms: number | null; burst_remaining: number | null; daily_remaining: number | null; error: string | null }[];
};

export type Mismatch = { id: string; kind: 'missing' | 'extra' | 'wrong_permissions'; detail: string; found_at: string; ghl_user_id: string | null; resolution: string | null; client?: string; case_file_id?: string };

export type PlacementOption = { placement_id: string; operator: string; status: string; shift: string; on_shift_now: boolean };

export type AccessOverview = {
  can_manage: boolean;
  people: {
    profile_id: string;
    name: string;
    email: string;
    role: string;
    state: string;
    barrier: string | null;
    ghl_user_id: string | null;
    admin_optin: boolean;
    blocked: boolean;
    should_have: { case_file_id: string; name: string; reason: string }[];
    grants: { grant_id: string; case_file_id: string; name: string; state: string; last_error: string | null }[];
    has: { case_file_id: string; name: string }[];
  }[];
  mismatches: Mismatch[];
  jobs: { id: number; kind: string; status: string; attempts: number; last_error: string | null; created_at: string; next_attempt_at: string; client: string }[];
  profiles: { key: string; label: string; ghl_role: string; permissions: Record<string, boolean>; verify_manually: string[]; updated_at: string }[];
};

export type ActivityHealth = {
  case_file_id: string;
  name: string;
  is_test: boolean;
  endpoint: boolean;
  polled_at: string | null;
  last_event_at: string | null;
  by_type: Record<string, { last: string; day: number }>;
  status_24h: Record<string, number>;
  waiting: number;
  failed_24h: number;
  unknown_24h: number;
  auth_failures_24h: number;
  touches_24h: Record<string, number>;
  estimated_24h: number;
  unrecognised_users: string[];
  silence_alerted_at: string | null;
  on_shift_now: boolean;
  recent_failures: { id: string; event_type: string | null; status: string; error: string | null; received_at: string }[];
}[];

export type RoutingLog = {
  can_manage: boolean;
  decisions: {
    id: number;
    at: string;
    kind: string;
    reason: string;
    candidates: { placement_id: string; operator_id: string; name: string; on_shift: boolean; open_leads: number; skipped: string | null }[];
    lead_id: string;
    case_file_id: string;
    client: string;
    chosen: string | null;
    lead_name: string | null;
    state: string | null;
    owner_state: string | null;
    owner_error: string | null;
    touched_at: string | null;
    assigned_at: string | null;
    response_minutes: number | null;
    counts_toward_response: boolean;
  }[];
  queue: { lead_id: string; client: string; state: string; created_at: string; lead_name: string | null }[];
};

export type Standard = {
  can_manage: boolean;
  items: { id: string; kind: string; name: string; parent_name: string | null; position: number | null; field_type: string | null; active: boolean; note: string | null }[];
  profiles: { key: string; label: string; ghl_role: string; ghl_type: string; permissions: Record<string, boolean>; verify_manually: string[] }[];
};

export type PortalGhl = {
  clients: { case_file_id: string; client: string; location_id: string | null; state: 'ready' | 'pending' | 'removing' | 'none' | 'not_connected'; connection_ok: boolean }[];
  leads: { lead_id: string; name: string | null; client: string; assigned_at: string; minutes_waiting: number; reminded: boolean; contact_id: string; location_id: string | null; standard_minutes: number }[];
};
