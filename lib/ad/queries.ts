import { controlRpc } from '@/lib/ad/rpc';
import type {
  AccountInvite,
  AccountRow,
  AccountScope,
  AuditEvent,
  ClientCredential,
  OpenWorkItem,
  OwnerAlert,
  PermissionDecision,
  ScopeKind,
  UserRole,
} from '@/lib/ad/types';
import { createClient, isControlPlaneSession } from '@/lib/supabase/server';

export async function listAccounts(): Promise<AccountRow[]> {
  if (!(await isControlPlaneSession())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profile')
    .select(
      'id, email, full_name, role, state, expires_on, time_zone, must_change_password, mfa_required, failed_attempts, locked_until, locked_reason, ip_allowlist, restrict_to_shift, shift_override, session_timeout_minutes, suspended_at, suspended_reason, soft_deleted_at, archived_at, last_sign_in_at, invited_by, accepted_at, notes, created_at, updated_at',
    )
    .order('email');
  if (error) {
    console.error('listAccounts', error.message);
    return [];
  }
  return (data ?? []) as AccountRow[];
}

export async function getAccount(id: string): Promise<AccountRow | null> {
  if (!(await isControlPlaneSession())) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profile')
    .select(
      'id, email, full_name, role, state, expires_on, time_zone, must_change_password, mfa_required, failed_attempts, locked_until, locked_reason, ip_allowlist, restrict_to_shift, shift_override, session_timeout_minutes, suspended_at, suspended_reason, soft_deleted_at, archived_at, last_sign_in_at, invited_by, accepted_at, notes, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('getAccount', error.message);
    return null;
  }
  return data as AccountRow | null;
}

export async function getAccountScope(profileId: string): Promise<{
  scope: AccountScope | null;
  caseFileIds: string[];
  placementIds: string[];
}> {
  if (!(await isControlPlaneSession())) return { scope: null, caseFileIds: [], placementIds: [] };
  const supabase = await createClient();

  const { data: scope } = await (supabase as unknown as { from: Function })
    .from('account_scope')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  const { data: clients } = await (supabase as unknown as { from: Function })
    .from('account_scope_client')
    .select('case_file_id')
    .eq('profile_id', profileId);

  const { data: placements } = await (supabase as unknown as { from: Function })
    .from('account_scope_placement')
    .select('placement_id')
    .eq('profile_id', profileId);

  return {
    scope: (scope as AccountScope | null) ?? null,
    caseFileIds: ((clients as { case_file_id: string }[] | null) ?? []).map((r) => r.case_file_id),
    placementIds: ((placements as { placement_id: string }[] | null) ?? []).map((r) => r.placement_id),
  };
}

export async function explainPermission(
  permission: string,
  profileId?: string,
): Promise<PermissionDecision | null> {
  if (!(await isControlPlaneSession())) return null;
  const supabase = await createClient();
  const { data, error } = await controlRpc<PermissionDecision[]>(supabase, 'explain_permission', {
    p_permission: permission,
    ...(profileId ? { p_profile_id: profileId } : {}),
  });
  if (error) return null;
  return Array.isArray(data) ? data[0] ?? null : null;
}

export async function openWorkFor(profileId: string): Promise<OpenWorkItem[]> {
  if (!(await isControlPlaneSession())) return [];
  const supabase = await createClient();
  const { data, error } = await controlRpc<OpenWorkItem[]>(supabase, 'open_work_for', {
    p_profile_id: profileId,
  });
  if (error) {
    console.error('openWorkFor', error.message);
    return [];
  }
  return data ?? [];
}

export async function listAuditEvents(limit = 100, profileId?: string): Promise<AuditEvent[]> {
  if (!(await isControlPlaneSession())) return [];
  const supabase = await createClient();
  let query = (supabase as unknown as { from: Function })
    .from('audit_event')
    .select('*')
    .order('id', { ascending: false })
    .limit(limit);
  if (profileId) {
    query = query.or(
      `actor_profile_id.eq.${profileId},acting_as_profile_id.eq.${profileId},entity_id.eq.${profileId}`,
    );
  }
  const { data, error } = await query;
  if (error) {
    console.error('listAuditEvents', error.message);
    return [];
  }
  return (data ?? []) as AuditEvent[];
}

export async function listOwnerAlerts(): Promise<OwnerAlert[]> {
  if (!(await isControlPlaneSession())) return [];
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as { from: Function })
    .from('owner_alert')
    .select('id, at, kind, severity, summary, subject_profile_id, acknowledged_at')
    .is('acknowledged_at', null)
    .order('id', { ascending: false })
    .limit(50);
  if (error) {
    console.error('listOwnerAlerts', error.message);
    return [];
  }
  return (data ?? []) as OwnerAlert[];
}

export async function listInvites(): Promise<AccountInvite[]> {
  if (!(await isControlPlaneSession())) return [];
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as { from: Function })
    .from('account_invite')
    .select(
      'id, email, full_name, role, scope_kind, scope_case_file_ids, expires_on, created_at, expires_at, accepted_at, cancelled_at, resent_count, last_sent_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('listInvites', error.message);
    return [];
  }
  return (data ?? []) as AccountInvite[];
}

export async function listCredentials(): Promise<ClientCredential[]> {
  if (!(await isControlPlaneSession())) return [];
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as { from: Function })
    .from('client_credential')
    .select('id, case_file_id, kind, label, username, notes, stale, created_at, updated_at, last_revealed_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('listCredentials', error.message);
    return [];
  }
  return (data ?? []) as ClientCredential[];
}

export async function listCaseFiles(): Promise<{ id: string; name: string; slug: string }[]> {
  if (!(await isControlPlaneSession())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('client_case_file')
    .select('id, name, slug')
    .order('name');
  if (error) return [];
  return data ?? [];
}

export async function listPermissions(): Promise<{ key: string; label: string; category: string }[]> {
  if (!(await isControlPlaneSession())) return [];
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as { from: Function })
    .from('permission')
    .select('key, label, category')
    .order('key');
  if (error) return [];
  return (data ?? []) as { key: string; label: string; category: string }[];
}

export async function listAccountOverrides(
  profileId: string,
): Promise<{ permission_key: string; effect: string; reason: string | null; expires_at: string | null }[]> {
  if (!(await isControlPlaneSession())) return [];
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as { from: Function })
    .from('account_permission')
    .select('permission_key, effect, reason, expires_at')
    .eq('profile_id', profileId);
  if (error) return [];
  return (data ?? []) as {
    permission_key: string;
    effect: string;
    reason: string | null;
    expires_at: string | null;
  }[];
}

export type { ScopeKind, UserRole };
