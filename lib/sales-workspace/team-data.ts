import 'server-only';

import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { attentionRank, presentTeamRow, type CertStatus, type EodStatus, type TeamMetric, type TeamRow } from './team';

export type TodayPayload = {
  is_admin: boolean;
  refreshed_at: string;
  refresh_minutes: number;
  summary: {
    on_shift: number;
    off_shift: number;
    not_working_day: number;
    eod: Record<EodStatus, number>;
    overdue_tasks: number;
    unread_alerts: number;
    open_mismatches?: number;
  };
  operators: TeamRow[];
  domain?: { origin: string; also_active: string[]; retired: string[] };
};

export type OperatorDetail = {
  is_admin: boolean;
  operator: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    handle: string | null;
    has_account: boolean;
    certification_level: number | null;
    certification: CertStatus;
    recertify_on: string | null;
  };
  placement: {
    id: string;
    client_name: string;
    placement_type: string;
    status: string;
    manager_name: string | null;
    time_zone: string;
    shift_start: string;
    shift_end: string;
    working_days: number[];
    eod_deadline: string;
    start_date: string;
    review_on: string;
    local_minutes: number;
    shift_status: TeamRow['shift_status'];
  } | null;
  today: TeamMetric[];
  week: Array<TeamMetric & { previous: number | null; trend: 'up' | 'down' | 'flat' | null }>;
  days: Array<{ date: string; conversations: number | null }>;
  quick_log: Array<{ at: string; label: string; previous: number | null; value: number; source?: string; by: string | null }>;
  tasks: Array<{ id: string; title: string; detail: string | null; due_on: string | null; completed_on: string | null; overdue: boolean }>;
  alerts: Array<{ id: string; title: string; body: string; kind: string; created_at: string; read_at: string | null; from: string | null }>;
  targets: Array<{
    metric_key: string;
    label: string;
    daily: number | null;
    weekly: number | null;
    layer: string | null;
    set_by: string | null;
    set_at: string | null;
    default_daily: number | null;
    default_weekly: number | null;
  }>;
  override_min_pct: number | null;
  override_max_pct: number | null;
  eods: Array<{
    id: string;
    work_date: string;
    status: EodStatus;
    was_late: boolean;
    submitted_at: string | null;
    feedback_count: number;
    client_name: string;
  }>;
  placements: Array<{ id: string; client_name: string; status: string; start_date: string; end_date: string | null; closed_on: string | null }>;
  mismatches?: Array<{
    id: string;
    work_date: string;
    metric_key: string;
    label: string;
    operator_value: number | null;
    ghl_value: number | null;
    gap: number;
    status: string;
  }>;
};

export type EodListRow = {
  id: string;
  operator_id: string;
  operator_name: string;
  client_id: string;
  client_name: string;
  manager_id: string | null;
  manager_name: string | null;
  work_date: string;
  status: EodStatus;
  submitted_at: string | null;
  was_late: boolean;
  needs_help?: boolean;
  escalated?: boolean;
  reviewed?: boolean;
  feedback_count: number;
};

export type EodDetail = {
  is_admin: boolean;
  id: string;
  operator_id: string;
  operator_name: string;
  client_name: string;
  manager_name: string | null;
  work_date: string;
  status: EodStatus;
  was_late: boolean;
  submitted_at: string | null;
  deadline_at: string;
  time_zone: string;
  wins: string | null;
  blockers: string | null;
  tomorrow_plan: string | null;
  hours_worked: number | null;
  note_to_manager: string | null;
  numbers: TeamMetric[];
  feedback: Array<{ id: string; author_kind: string; author_name: string | null; body: string; rating: number | null; created_at: string }>;
};

export type ActivityEvent = {
  id: string;
  at: string;
  type: string;
  summary: string;
  actor_id: string | null;
  actor_name: string | null;
  operator_id: string | null;
  operator_name: string | null;
};

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<{ data: T | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<T>(supabase, fn, args);
  if (error || data == null) return { data: null, error: readable(error) };
  return { data, error: null };
}

function sortRows(rows: TeamRow[], isAdmin: boolean): TeamRow[] {
  return rows
    .map((row) => presentTeamRow(row, isAdmin))
    .sort((a, b) => attentionRank(a) - attentionRank(b) || a.name.localeCompare(b.name));
}

export async function loadToday(): Promise<{ data: TodayPayload | null; error: string | null }> {
  const result = await call<TodayPayload>('so_team_today');
  if (!result.data) return result;
  const data = result.data;
  if (!data.is_admin) {
    delete data.domain;
    delete data.summary.open_mismatches;
  }
  data.operators = sortRows(data.operators ?? [], data.is_admin);
  return { data, error: null };
}

export async function loadOperators(): Promise<{ data: { is_admin: boolean; operators: TeamRow[] } | null; error: string | null }> {
  const result = await call<{ is_admin: boolean; operators: TeamRow[] }>('so_team_operators');
  if (!result.data) return result;
  result.data.operators = sortRows(result.data.operators ?? [], result.data.is_admin);
  return result;
}

export async function loadOperator(operatorId: string): Promise<{ data: OperatorDetail | null; error: string | null }> {
  const result = await call<OperatorDetail>('so_team_operator', { p_operator_id: operatorId });
  if (!result.data) return result;
  if (!result.data.is_admin) {
    delete result.data.mismatches;
    result.data.today = (result.data.today ?? []).map((metric) => {
      const next = { ...metric };
      delete next.ghl;
      return next;
    });
    result.data.week = (result.data.week ?? []).map((metric) => {
      const next = { ...metric };
      delete next.ghl;
      return next;
    });
  }
  return result;
}

export async function loadEods(filters: {
  from?: string | null;
  to?: string | null;
  status?: string | null;
  operatorId?: string | null;
  managerId?: string | null;
  clientId?: string | null;
  hasFeedback?: boolean | null;
}): Promise<{ data: { is_admin: boolean; eods: EodListRow[] } | null; error: string | null }> {
  return call('so_team_eods', {
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_status: filters.status || null,
    p_operator_id: filters.operatorId || null,
    p_manager_id: filters.managerId || null,
    p_client_id: filters.clientId || null,
    p_has_feedback: filters.hasFeedback ?? null,
  });
}

export async function loadEod(eodId: string): Promise<{ data: EodDetail | null; error: string | null }> {
  const result = await call<EodDetail>('so_team_eod', { p_eod_id: eodId });
  if (!result.data) return result;
  if (!result.data.is_admin) {
    result.data.numbers = (result.data.numbers ?? []).map((metric) => {
      const next = { ...metric };
      delete next.ghl;
      return next;
    });
  }
  return result;
}

export async function loadActivity(filters: {
  operatorId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  type?: string | null;
  from?: string | null;
  to?: string | null;
  zone?: string | null;
}): Promise<{ data: { is_admin: boolean; events: ActivityEvent[] } | null; error: string | null }> {
  return call('so_team_activity', {
    p_operator_id: filters.operatorId || null,
    p_actor_id: filters.actorId || null,
    p_type: filters.type || null,
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_zone: filters.zone || null,
    p_actor_name: filters.actorName || null,
  });
}
