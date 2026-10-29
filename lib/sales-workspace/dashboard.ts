/** Shapes returned by the dashboard functions. The screen does not invent numbers. */

export type EodStatus = 'not_started' | 'draft' | 'submitted' | 'late' | 'missed' | 'excused';

export type Pace = 'on_track' | 'behind' | 'met';

export type Viewer = {
  view_as: boolean;
  actor_name: string | null;
  actor_role: string | null;
  expires_at: string | null;
};

export type OutcomeBrief = { id: string; name: string; definition: string };

export type DashboardPlacement = {
  id: string;
  client_name: string | null;
  manager_name: string | null;
  placement_type: 'client_placed' | 'da_internal';
  time_zone: string;
  working_days: number[];
  shift_start: string;
  shift_end: string;
  eod_deadline: string;
  campaign_summary: string | null;
  outcomes: OutcomeBrief[];
};

export type EodCard = {
  id: string | null;
  work_date: string;
  status: EodStatus;
  deadline_at: string;
  submitted_at: string | null;
  was_late: boolean;
  feedback_count: number;
  remaining_seconds: number | null;
  late_seconds: number | null;
  updated_at?: string | null;
  edited_after_submit?: boolean;
  editable?: boolean;
};

export type CertBanner = {
  phase: 'warning' | 'grace';
  recertify_on: string;
  grace_ends_on: string;
};

export type DashboardResponse = {
  state: string;
  operator_name?: string;
  operator_id?: string | null;
  viewer?: Viewer;
  reason?: string;
  pending?: boolean;
  grace_ended?: boolean;
  certification_level?: number | null;
  today?: string;
  yesterday?: string | null;
  certification?: (CertBanner & { days_left?: number | null }) | null;
  quick_log_open?: boolean;
  placement?: DashboardPlacement;
  eod?: { today: EodCard; yesterday: EodCard | null };
};

export type TrendPoint = { date: string; value: number | null };

export type MetricRow = {
  key: string;
  label: string;
  unit: string;
  section: 'primary' | 'other';
  operator_editable: boolean;
  by_outcome: boolean;
  today_display: 'number' | 'pending_sync';
  week_display: 'number' | 'pending_sync';
  today: number | null;
  week: number | null;
  target_today: number | null;
  target_week: number | null;
  target_layer_today: 'default' | 'override' | null;
  target_layer_week: 'default' | 'override' | null;
  pace_today: Pace | null;
  pace_week: Pace | null;
  trend: TrendPoint[];
};

export type OutcomeCount = {
  id: string;
  name: string;
  today: number;
  week: number;
  trend: TrendPoint[];
};

export type MetricGroup = { key: string; label: string; metrics: MetricRow[] };

export type TaskItem = {
  id: string;
  title: string;
  note: string | null;
  source: 'system' | 'manager' | 'ghl';
  created_by: string;
  due_on: string | null;
  due_time: string | null;
  priority: 'normal' | 'high';
  overdue: boolean;
};

export type AlertItem = {
  id: string;
  kind: string;
  type_label: string;
  text: string;
  from: string;
  created_at: string;
  read?: boolean;
  href: string | null;
};

export type BoardData = {
  state: string;
  today?: string;
  week_start?: string;
  week_through?: string;
  view_as: boolean;
  quick_log_open: boolean;
  quick_log_message: string | null;
  tasks: TaskItem[];
  done_today: number;
  alerts: AlertItem[];
  unread_alerts: number;
  any_logged: boolean;
  groups: MetricGroup[];
  outcomes: OutcomeCount[];
};

export type EodListItem = {
  id: string;
  work_date: string;
  status: EodStatus;
  was_late: boolean;
  has_feedback: boolean;
};

export type EodNumber = {
  group: string;
  label: string;
  unit: string;
  display: 'number' | 'pending_sync';
  value: number | null;
};

export type EodFeedback = {
  id: string;
  parent_id?: string | null;
  author_kind: 'manager' | 'admin' | 'client' | 'operator';
  author_name: string;
  body: string;
  rating: number | null;
  created_at: string;
};

export type EodDetail = {
  id: string;
  work_date: string;
  status: EodStatus;
  was_late: boolean;
  submitted_at: string | null;
  wins: string | null;
  blockers: string | null;
  tomorrow_plan: string | null;
  hours_worked: number | null;
  note_to_manager: string | null;
  plan_items?: { text?: string; done_at?: string | null }[];
  needs_help?: boolean;
  edited_after_submit?: boolean;
  view_as?: boolean;
  numbers: EodNumber[];
  feedback: EodFeedback[];
};

export const EOD_STATUS_LABEL: Record<EodStatus, string> = {
  not_started: 'Not started',
  draft: 'Draft',
  submitted: 'Submitted',
  late: 'Late',
  missed: 'Missed',
  excused: 'Excused',
};

export const VIEW_AS_BLOCK = 'View-as is read-only. Exit to let the operator do this.';

export const PACE_LABEL: Record<Pace, string> = {
  on_track: 'On track',
  behind: 'Behind',
  met: 'Met',
};

export function isActiveDashboard(data: DashboardResponse): data is DashboardResponse & {
  state: 'active';
  today: string;
  placement: DashboardPlacement;
  eod: { today: EodCard; yesterday: EodCard | null };
  viewer: Viewer;
} {
  return data.state === 'active' && Boolean(data.eod && data.placement && data.today && data.viewer);
}

/** A bar only when this mode has a real number and a target above zero. */
export function showsTargetBar(
  metric: Pick<MetricRow, 'today_display' | 'week_display' | 'target_today' | 'target_week'>,
  mode: 'today' | 'week',
): boolean {
  const display = mode === 'today' ? metric.today_display : metric.week_display;
  const target = mode === 'today' ? metric.target_today : metric.target_week;
  return display === 'number' && target != null && target > 0;
}

export function formatSpan(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 0) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 48) return rest ? `${hours}h ${rest}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function formatMetric(unit: string, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'Pending sync';
  const trimmed = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  if (unit === 'minutes') return `${trimmed} min`;
  if (unit === 'percent') return `${trimmed}%`;
  if (unit === 'seconds') {
    if (value < 60) return `${Math.round(value)}s`;
    const minutes = Math.floor(value / 60);
    const rest = Math.round(value % 60);
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  }
  return trimmed;
}

export function placementTypeLabel(value: string | null | undefined): string {
  if (value === 'da_internal') return 'DA internal';
  if (value === 'client_placed') return 'Client-placed';
  return 'Placement';
}
