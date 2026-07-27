/** Control-plane roles and account shapes used by the /ad workspace. */

export type UserRole = 'owner' | 'admin' | 'manager' | 'operator' | 'contractor' | 'client';

export type AccountState =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'locked'
  | 'expired'
  | 'archived';

export type ScopeKind = 'all_clients' | 'clients' | 'placements';

export type PermissionEffect = 'grant' | 'deny';

export type NotificationSeverity = 'urgent' | 'critical' | 'normal';

export type AccountRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  state: AccountState;
  expires_on: string | null;
  time_zone: string | null;
  must_change_password: boolean;
  mfa_required: boolean | null;
  failed_attempts: number;
  locked_until: string | null;
  locked_reason: string | null;
  ip_allowlist: string[] | null;
  restrict_to_shift: boolean;
  shift_override: boolean;
  session_timeout_minutes: number | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  soft_deleted_at: string | null;
  archived_at: string | null;
  last_sign_in_at: string | null;
  invited_by: string | null;
  accepted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AccountScope = {
  profile_id: string;
  kind: ScopeKind;
  set_by: string | null;
  updated_at: string;
};

export type ImpersonationContext = {
  id: string;
  actor_profile_id: string;
  target_profile_id: string;
  target_email: string | null;
  target_full_name: string | null;
  target_role: UserRole | null;
  reason: string | null;
  started_at: string;
  expires_at: string;
};

export type OpenWorkItem = {
  kind: string;
  label: string;
  count: number;
};

export type PermissionDecision = {
  allowed: boolean;
  layer: string;
  reason: string;
};

export type AuditEvent = {
  id: number;
  at: string;
  actor_profile_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  acting_as_profile_id: string | null;
  impersonation_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  case_file_id: string | null;
  summary: string | null;
  before_value: unknown;
  after_value: unknown;
  ip: string | null;
  user_agent: string | null;
  surface: string | null;
};

export type OwnerAlert = {
  id: number;
  at: string;
  kind: string;
  severity: string;
  summary: string;
  subject_profile_id: string | null;
  acknowledged_at: string | null;
};

export type AccountInvite = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  scope_kind: ScopeKind;
  scope_case_file_ids: string[];
  expires_on: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
  resent_count: number;
  last_sent_at: string;
};

export type ClientCredential = {
  id: string;
  case_file_id: string;
  kind: string;
  label: string;
  username: string | null;
  notes: string | null;
  stale: boolean;
  created_at: string;
  updated_at: string;
  last_revealed_at: string | null;
};

export const CONTROL_ROLES: UserRole[] = ['owner', 'admin', 'manager'];
export const STAFF_ROLES: UserRole[] = ['owner', 'admin', 'manager', 'operator', 'contractor'];

export function roleLabel(role: UserRole | string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function stateLabel(state: AccountState | string): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}
