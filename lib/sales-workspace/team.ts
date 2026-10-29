/** Shared labels and the rules behind the Team Workspace table. */

export type ShiftStatus = 'on_shift' | 'off_shift' | 'not_working_day';
export type EodStatus = 'not_started' | 'draft' | 'submitted' | 'late' | 'missed' | 'excused';
export type CertStatus = 'current' | 'warning' | 'grace' | 'lapsed' | 'none';
export type Pace = 'on_track' | 'behind' | 'met';

export type TeamMetric = {
  key: string;
  label: string;
  operator: number | null;
  /** Present for DA Admin only. Null means GHL has not reported it. */
  ghl?: number | null;
  ghl_state?: 'pending_sync' | 'sync_delayed' | 'number';
  daily_target: number | null;
  weekly_target: number | null;
  /** GHL-only metrics wait for sync. They do not mark a row behind. */
  pace?: boolean;
};

export type TeamRow = {
  operator_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  placement_id: string | null;
  client_id?: string | null;
  client_name: string | null;
  placement_type: string | null;
  placement_status: string | null;
  manager_id: string | null;
  manager_name: string | null;
  shift_status: ShiftStatus | null;
  time_zone: string | null;
  shift_start: string | null;
  shift_end: string | null;
  local_minutes: number | null;
  working_day: boolean;
  eod_status: EodStatus | null;
  was_late: boolean;
  ghl_connected?: boolean;
  needs_help?: boolean;
  escalated?: boolean;
  last_activity_at: string | null;
  last_activity_kind: string | null;
  tasks_open: number;
  tasks_overdue: number;
  alerts_unread: number;
  certification: CertStatus;
  recertify_on: string | null;
  metrics: TeamMetric[];
  open_mismatch?: boolean;
  pace?: Pace | null;
};

export const KEY_METRIC_KEYS = [
  'conversations_held',
  'positive_outcomes',
  'texts_sent',
  'emails_sent',
  'reactivated_bookings',
] as const;

export const SHIFT_LABEL: Record<ShiftStatus, string> = {
  on_shift: 'On shift',
  off_shift: 'Off shift',
  not_working_day: 'Not a working day',
};

export const EOD_LABEL: Record<EodStatus, string> = {
  not_started: 'Not started',
  draft: 'Draft',
  submitted: 'Submitted',
  late: 'Late',
  missed: 'Missed',
  excused: 'Excused',
};

export const CERT_LABEL: Record<CertStatus, string> = {
  current: 'Current',
  warning: 'In warning window',
  grace: 'In grace period',
  lapsed: 'Lapsed',
  none: 'Not certified',
};

export const PACE_LABEL: Record<Pace, string> = {
  on_track: 'On track',
  behind: 'Behind',
  met: 'Met',
};

export const ACTIVITY_LABEL: Record<string, string> = {
  quick_log: 'Quick log',
  task: 'Task',
  sign_in: 'Signed in',
  workspace: 'Opened workspace',
};

/** Same tones on the operator dashboard and this tab. */
export const EOD_TONE: Record<EodStatus, string> = {
  not_started: 'border-white/10 bg-white/[0.04] text-neutral-300',
  draft: 'border-flag-warning/35 bg-flag-warning/12 text-flag-warning',
  submitted: 'border-flag-good/35 bg-flag-good/12 text-flag-good',
  late: 'border-flag-critical/35 bg-flag-critical/12 text-flag-critical',
  missed: 'border-flag-critical/35 bg-flag-critical/12 text-flag-critical',
  excused: 'border-white/10 bg-white/[0.04] text-neutral-300',
};

export const PACE_TONE: Record<Pace, string> = {
  on_track: 'border-flag-good/35 bg-flag-good/12 text-flag-good',
  behind: 'border-flag-warning/35 bg-flag-warning/12 text-flag-warning',
  met: 'border-brand-500/25 bg-brand-500/10 text-brand-100',
};

export const CERT_TONE: Record<CertStatus, string> = {
  current: 'border-flag-good/35 bg-flag-good/12 text-flag-good',
  warning: 'border-flag-warning/35 bg-flag-warning/12 text-flag-warning',
  grace: 'border-flag-critical/35 bg-flag-critical/12 text-flag-critical',
  lapsed: 'border-flag-critical/35 bg-flag-critical/12 text-flag-critical',
  none: 'border-white/10 bg-white/[0.04] text-neutral-400',
};

export const PLACEMENT_TYPE_LABEL: Record<string, string> = {
  client_placed: 'Client-placed',
  da_internal: 'DA internal',
};

function minutes(value: string): number {
  const [hour, minute] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return hour * 60 + minute;
}

/**
 * Met when the logged number has reached the daily target.
 * On track when the number is at least the share of the shift already worked.
 * Behind after the shift, or during it when the number is short of that share.
 * No marker when no target is set.
 */
export function paceForMetric(input: {
  value: number | null;
  target: number | null;
  shiftStart: string;
  shiftEnd: string;
  nowMinutes: number;
  onShift: boolean;
  workingDay: boolean;
}): Pace | null {
  if (input.target == null || input.target <= 0) return null;
  const value = input.value ?? 0;
  if (value >= input.target) return 'met';
  const start = minutes(input.shiftStart);
  const end = minutes(input.shiftEnd);
  const crosses = end <= start;
  const duration = Math.max(1, crosses ? 24 * 60 - start + end : end - start);
  if (!input.onShift) {
    if (input.workingDay && !crosses && input.nowMinutes < start) return 'on_track';
    return 'behind';
  }
  let elapsed = input.nowMinutes - start;
  if (crosses && elapsed < 0) elapsed = 24 * 60 - start + input.nowMinutes;
  if (elapsed < 0) elapsed = 0;
  const expected = input.target * Math.min(1, elapsed / duration);
  return value + 1e-9 >= expected ? 'on_track' : 'behind';
}

export function worstPace(paces: Array<Pace | null>): Pace | null {
  const present = paces.filter((pace): pace is Pace => pace != null);
  if (present.length === 0) return null;
  if (present.includes('behind')) return 'behind';
  if (present.includes('on_track')) return 'on_track';
  return 'met';
}

export function paceForRow(row: Pick<TeamRow, 'metrics' | 'shift_start' | 'shift_end' | 'local_minutes' | 'shift_status' | 'working_day'>): Pace | null {
  if (!row.shift_start || !row.shift_end || row.local_minutes == null) return null;
  return worstPace(
    row.metrics.map((metric) =>
      metric.pace === false
        ? null
        : paceForMetric({
            value: metric.operator,
            target: metric.daily_target,
            shiftStart: row.shift_start as string,
            shiftEnd: row.shift_end as string,
            nowMinutes: row.local_minutes as number,
            onShift: row.shift_status === 'on_shift',
            workingDay: row.working_day,
          }),
    ),
  );
}

/** Late or missed EOD, then overdue tasks, grace, behind target, then everyone else. */
export function attentionRank(row: {
  eod_status: EodStatus | null;
  tasks_overdue: number;
  certification: CertStatus;
  pace?: Pace | null;
  needs_help?: boolean;
  escalated?: boolean;
}): number {
  if (row.eod_status === 'late' || row.eod_status === 'missed' || row.needs_help || row.escalated) return 0;
  if (row.tasks_overdue > 0) return 1;
  if (row.certification === 'grace') return 2;
  if (row.pace === 'behind') return 3;
  return 4;
}

/** Drops GHL numbers and mismatch markers unless the viewer is DA Admin. */
export function presentTeamRow(row: TeamRow, isAdmin: boolean): TeamRow {
  const metrics = row.metrics.map((metric) => {
    if (isAdmin) return metric;
    const rest = { ...metric };
    delete rest.ghl;
    delete rest.ghl_state;
    return rest;
  });
  const next: TeamRow = { ...row, metrics, pace: paceForRow({ ...row, metrics }) };
  if (!isAdmin) delete next.open_mismatch;
  return next;
}

export function metricNumber(metrics: TeamMetric[], key: string): number | null {
  const found = metrics.find((metric) => metric.key === key);
  return found ? found.operator : null;
}

export function formatCount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function formatWhen(iso: string | null, timeZone: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function viewerTimeZone(): string {
  if (typeof Intl === 'undefined') return 'UTC';
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
