import 'server-only';
import { controlRpc } from '@/lib/ad/rpc';
import { getSessionContext } from '@/lib/supabase/server';
import { workspaceClient } from './db';

export async function salesOpsRole(): Promise<'admin' | 'manager' | null> {
  const session = await getSessionContext();
  if (!session || session.state !== 'active') return null;
  if (session.isAdmin) return 'admin';
  if (session.role === 'manager') return 'manager';
  return null;
}

export type RosterRow = {
  placement_id: string;
  operator_id: string;
  operator_name: string;
  client_name: string;
  status: string;
  shift: string;
  time_zone: string;
  eod_deadline: string;
  manager_name: string | null;
  review_on: string | null;
};

export async function listRoster(): Promise<RosterRow[]> {
  const supabase = await workspaceClient();
  if (!supabase) return [];
  const { data } = await controlRpc<RosterRow[]>(supabase, 'so_manager_operators');
  return data ?? [];
}

export type WorkspaceAlert = {
  id: string;
  kind: string;
  summary: string;
  period_on: string;
  created_at: string;
  operator_name: string;
  placement_id: string | null;
};

export async function listWorkspaceAlerts(): Promise<WorkspaceAlert[]> {
  const supabase = await workspaceClient();
  if (!supabase) return [];
  const { data } = await controlRpc<WorkspaceAlert[]>(supabase, 'so_workspace_alerts');
  return data ?? [];
}

export type PlacementDetail = {
  placement: {
    id: string;
    status: string;
    placement_type: string | null;
    operator_name: string;
    client_name: string;
    manager_name: string | null;
    start_date: string;
    end_date: string;
    review_on: string | null;
    time_zone: string;
    working_days: number[];
    shift_start: string;
    shift_end: string;
    eod_deadline: string;
    campaign_summary: string | null;
    activity_categories: string[];
    tracks_results: boolean;
    paused_at: string | null;
  };
  outcomes: { id: string; name: string; definition: string; active: boolean }[];
  eods: { id: string; work_date: string; status: string; submitted_at: string | null; was_late: boolean }[];
  feedback: { id: string; body: string; author_kind: string; created_at: string }[];
  targets: { metric_key: string; daily: number | null; weekly: number | null; effective_from: string }[];
};

export async function placementDetail(id: string): Promise<PlacementDetail | null> {
  const supabase = await workspaceClient();
  if (!supabase) return null;
  const { data } = await controlRpc<PlacementDetail | null>(supabase, 'so_placement_detail', { p_id: id });
  return data;
}

/** Reads for the DA Admin workspace setup screens. RLS admits DA Admin only. */

export type PlacementRow = {
  id: string;
  status: string;
  placement_type: string | null;
  operator_id: string;
  case_file_id: string;
  manager_profile_id: string | null;
  start_date: string;
  end_date: string;
  review_on: string | null;
  closed_on: string | null;
  time_zone: string;
  working_days: number[];
  shift_start: string;
  shift_end: string;
  eod_deadline: string | null;
  campaign_summary: string | null;
  activity_categories: string[];
  tracks_results: boolean;
  paused_at: string | null;
  operator: { name: string; email: string; profile_id: string | null } | null;
  client: { name: string } | null;
  manager: { full_name: string | null; email: string } | null;
};

export type OutcomeRow = {
  id: string;
  placement_id: string;
  name: string;
  definition: string;
  active: boolean;
  sort_order: number;
};

export type MetricRow = {
  key: string;
  label: string;
  description: string;
  category: string;
  source: string;
  unit: string;
  operator_editable: boolean;
  by_outcome: boolean;
  active: boolean;
  sort_order: number;
};

export type TargetRow = {
  id: string;
  metric_key: string;
  placement_type: string | null;
  daily: number | null;
  weekly: number | null;
  effective_from: string;
  set_at: string;
  note: string | null;
  setter: { full_name: string | null; email: string } | null;
};

export type WorkspaceSettings = {
  mismatch_tolerance_pct: number;
  mismatch_small_count_under: number;
  mismatch_small_count_gap: number;
  eod_reminder_minutes_before: number;
  eod_late_minutes_after: number;
  eod_manager_alert_minutes_after: number;
  eod_missed_rule: 'next_shift_start' | 'hours_after_deadline';
  eod_missed_hours_after: number | null;
  eod_edit_rule: 'until_next_shift' | 'hours_after_submit' | 'never';
  eod_edit_hours_after: number | null;
  eod_hours_worked_enabled: boolean;
  eod_note_to_manager_enabled: boolean;
  eod_min_text_chars: number;
  ghl_sync_interval_minutes: number;
  ghl_connect_seconds: number;
  ghl_conversation_seconds: number;
  ghl_reply_window_days: number;
  ghl_noshow_window_days: number;
  ghl_stl_pause_outside_shift: boolean;
  ghl_stl_notouch_hours: number;
  ghl_backfill_days: number;
  ghl_sync_fail_after: number;
  client_feedback_token_days: number;
  cert_warning_days: number;
  cert_grace_days: number;
  view_as_idle_minutes: number;
  placement_review_months: number;
  speed_to_lead_target_seconds: number | null;
  target_override_min_pct: number | null;
  target_override_max_pct: number | null;
  updated_at: string;
};

const PLACEMENT_SELECT =
  'id, status, placement_type, operator_id, case_file_id, manager_profile_id, start_date, end_date, review_on, closed_on, time_zone, working_days, shift_start, shift_end, eod_deadline, campaign_summary, activity_categories, tracks_results, paused_at, operator:operator_id(name, email, profile_id), client:case_file_id(name), manager:manager_profile_id(full_name, email)';

export async function listPlacements(): Promise<{ rows: PlacementRow[]; error: string | null }> {
  const supabase = await workspaceClient();
  if (!supabase) return { rows: [], error: 'Database not configured.' };
  const { data, error } = await supabase.from('placement').select(PLACEMENT_SELECT).order('start_date', { ascending: false });
  return { rows: (data ?? []) as unknown as PlacementRow[], error: error?.message ?? null };
}

export async function getPlacement(id: string) {
  const supabase = await workspaceClient();
  if (!supabase) return null;
  const [placement, outcomes] = await Promise.all([
    supabase.from('placement').select(PLACEMENT_SELECT).eq('id', id).maybeSingle(),
    supabase
      .from('placement_outcome_type')
      .select('id, placement_id, name, definition, active, sort_order')
      .eq('placement_id', id)
      .order('sort_order')
      .order('name'),
  ]);
  if (!placement.data) return null;
  const row = placement.data as unknown as PlacementRow;
  const [location, ghlUser] = await Promise.all([
    supabase.from('ghl_location').select('location_id, location_name').eq('case_file_id', row.case_file_id).maybeSingle(),
    row.operator?.profile_id
      ? supabase.from('ghl_user').select('ghl_user_id, name, email, deactivated_at').eq('profile_id', row.operator.profile_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    placement: row,
    outcomes: (outcomes.data ?? []) as OutcomeRow[],
    ghl: {
      location: (location.data as { location_id: string; location_name: string | null } | null) ?? null,
      user: (ghlUser.data as { ghl_user_id: string; name: string | null; email: string | null; deactivated_at: string | null } | null) ?? null,
    },
  };
}

export type PlacementFormOptions = {
  operators: { id: string; name: string; email: string; certified: boolean }[];
  clients: { id: string; name: string }[];
  managers: { id: string; name: string; role: string }[];
};

export async function placementFormOptions(): Promise<PlacementFormOptions> {
  const supabase = await workspaceClient();
  if (!supabase) return { operators: [], clients: [], managers: [] };
  const [operators, clients, managers, certs] = await Promise.all([
    supabase.from('operator').select('id, name, email, profile_id, status').neq('status', 'inactive').order('name'),
    supabase.from('client_case_file').select('id, name').eq('record_kind', 'client').order('name'),
    supabase.from('profile').select('id, full_name, email, role, state').in('role', ['manager', 'admin', 'owner']).order('full_name'),
    supabase.from('academy_certification').select('profile_id, level, recertify_on').gte('level', 1),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const certified = new Set(
    ((certs.data ?? []) as { profile_id: string; recertify_on: string | null }[])
      .filter((c) => !c.recertify_on || c.recertify_on >= today)
      .map((c) => c.profile_id),
  );
  return {
    operators: ((operators.data ?? []) as { id: string; name: string; email: string; profile_id: string | null }[]).map((o) => ({
      id: o.id,
      name: o.name,
      email: o.email,
      certified: Boolean(o.profile_id && certified.has(o.profile_id)),
    })),
    clients: (clients.data ?? []) as { id: string; name: string }[],
    managers: ((managers.data ?? []) as { id: string; full_name: string | null; email: string; role: string; state: string }[])
      .filter((m) => m.state === 'active')
      .map((m) => ({ id: m.id, name: m.full_name || m.email, role: m.role })),
  };
}

export async function listMetrics(): Promise<MetricRow[]> {
  const supabase = await workspaceClient();
  if (!supabase) return [];
  const { data } = await supabase.from('activity_metric').select('*').order('sort_order');
  return (data ?? []) as MetricRow[];
}

export async function listDefaultTargets(): Promise<TargetRow[]> {
  const supabase = await workspaceClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('activity_target')
    .select('id, metric_key, placement_type, daily, weekly, effective_from, set_at, note, setter:set_by(full_name, email)')
    .eq('layer', 'default')
    .order('effective_from', { ascending: false })
    .order('set_at', { ascending: false });
  return (data ?? []) as unknown as TargetRow[];
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  const supabase = await workspaceClient();
  if (!supabase) return null;
  const { data } = await supabase.from('team_setting').select('*').eq('id', 1).maybeSingle();
  return (data as WorkspaceSettings | null) ?? null;
}
