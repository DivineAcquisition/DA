/**
 * Shapes returned by the portal_* database functions. They list their fields on
 * the server; nothing here can add one (the client rate, for example, is never
 * in any of them).
 */

export type Severity = 'informational' | 'important' | 'urgent';

export type PortalPlacement = {
  id: string;
  client_name: string;
  status: string;
  live: boolean;
  start_date: string;
  end_date: string | null;
  shift_start: string | null;
  shift_end: string | null;
  time_zone: string;
  working_days: number[];
};

export type Notice = { id: string; body: string; severity: Severity; created_at: string };

export type PortalContext = {
  operator: { id: string; name: string; first_name: string; time_zone: string; status: string };
  viewer: {
    view_as: boolean;
    kind: 'view_as' | 'impersonation' | null;
    read_only: boolean;
    session_id: string | null;
    actor_name: string | null;
    actor_role: 'owner' | 'admin' | 'manager' | string | null;
    reason_kind: string | null;
    started_at: string | null;
    expires_at: string | null;
    extended: boolean;
    can_see_pay: boolean;
  };
  placements: PortalPlacement[];
  selected_placement_id: string | null;
  blocking_notices: Notice[];
  badges: {
    answers_ready: number;
    overdue_escalations: number;
    unread_notifications: number;
    open_tasks: number;
    pay_answers: number;
  };
  onboarding: { status: string; protocol_name: string; link_token: string | null } | null;
};

export type Window = { starts_at: string; ends_at: string };

export type TodayData = {
  placement_id: string;
  client_name: string;
  live: boolean;
  time_zone: string;
  operator_time_zone: string;
  shift_start: string | null;
  shift_end: string | null;
  working_days: number[];
  today: string;
  shift_today: Window | null;
  next_shift: Window | null;
  response_standard_minutes: number | null;
  escalation_response_hours: number | null;
  month: {
    label: string;
    confirmed: number;
    pending: number;
    quota: number | null;
    commission_per_booking: number | null;
    estimated_commission: number;
  };
  missing_reports: string[];
  answers_ready: { id: string; category: string; answered_at: string }[];
  overdue_escalations: number;
  tasks_due: { id: string; title: string; due_on: string; overdue: boolean }[];
  notifications: { id: string; title: string; body: string; severity: Severity; created_at: string }[];
  notices: Notice[];
};

export type BookingRow = {
  id: string;
  customer: string;
  scheduled_for: string;
  recorded_at: string;
  source: string;
  state: string;
  counts: boolean;
  matched: boolean;
  live_transfer: boolean;
  rejection_reason: string | null;
};

export type BookingsData = {
  placement_id: string;
  live: boolean;
  month: string;
  time_zone: string;
  current_period_start: string;
  counts: { counted: number; pending_review: number; rejected: number };
  bookings: BookingRow[];
};

export type BookingDetail = BookingRow & {
  placement_id: string;
  contacts_visible: boolean;
  customer_phone: string | null;
  customer_email: string | null;
  operator_note: string | null;
  reviewed_at: string | null;
  time_zone: string;
};

export type EscalationRow = {
  id: string;
  category: string;
  customer_context: string | null;
  needed: string | null;
  status: string;
  raised_at: string;
  response_due_at: string | null;
  answered_at: string | null;
  answer: string | null;
  answered_by: string | null;
  closed_at: string | null;
  overdue: boolean;
  answer_ready: boolean;
};

export type EscalationsData = {
  placement_id: string;
  live: boolean;
  escalation_response_hours: number | null;
  holding_line: string;
  escalations: EscalationRow[];
};

export type ReportRow = {
  id: string;
  shift_date: string;
  version: number;
  current: boolean;
  supersedes_id: string | null;
  submitted_at: string;
  shift_start_actual: string;
  shift_end_actual: string;
  conversations_handled: number;
  appointments_booked: number;
  follow_ups_completed: number;
  escalations_raised: number;
  blockers: string;
  notes: string;
  configured: Record<string, unknown>;
  system_counts: { appointments_booked: number; escalations_raised: number } | null;
  variance_explanation: string | null;
  correction_reason: string | null;
  correctable: boolean;
  comments: { author: string; body: string; created_at: string }[];
};

export type ConfiguredField = {
  key: string;
  label: string;
  type: string;
  options: string[] | null;
  required: boolean;
  help: string | null;
};

export type AttendanceRow = {
  shift_date: string;
  starts_at: string;
  ends_at: string;
  status: string;
  late_notice: boolean;
  reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
};

export type ReportsData = {
  placement_id: string;
  live: boolean;
  today: string;
  start_date: string;
  time_zone: string;
  shift_start: string | null;
  shift_end: string | null;
  configured_fields: ConfiguredField[];
  due: string[];
  reports: ReportRow[];
  attendance: AttendanceRow[];
};

export type Prefill = {
  shift_date: string;
  starts_at: string | null;
  ends_at: string | null;
  appointments_booked: number;
  escalations_raised: number;
  has_report: boolean;
  period_closed: boolean;
};

export type PlaybookData = {
  placement_id: string;
  available: boolean;
  exists: boolean;
  client_name: string;
  business_name?: string | null;
  offer?: string | null;
  locations?: string | null;
  hours?: string | null;
  qualifies?: string | null;
  disqualifiers?: string | null;
  handoff_method?: 'calendar' | 'live_transfer' | null;
  handoff_steps?: string | null;
  escalation_contacts?: string | null;
  never_say?: string | null;
  approved_pricing?: string | null;
  holding_lines?: string[];
  scripts?: { title: string; description: string | null; url: string | null }[];
  has_override?: boolean;
  version?: number;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type Statement = {
  id: string;
  period_id: string;
  period_start: string | null;
  period_end: string | null;
  period_status: string | null;
  closes_month: boolean | null;
  client_name: string;
  base_amount: number;
  base_detail: string | null;
  commission_amount: number;
  commission_detail: string | null;
  commission_bookings: { id: string; customer: string; scheduled_for: string; state: string; source: string }[];
  speed_bonus_amount: number;
  speed_bonus_detail: string | null;
  adjustments: { label: string; reason: string; amount: number; added_at: string }[];
  adjustment_total: number;
  total: number;
  locked: boolean;
  locked_at: string | null;
  payouts: {
    id: string;
    amount: number;
    method: string;
    status: string;
    sent_at: string | null;
    confirmed_at: string | null;
    failure_reason: string | null;
    rolled_into_period: string | null;
    rolled_from_period: string | null;
  }[];
  questions: {
    id: string;
    body: string;
    asked_at: string;
    answer: string | null;
    answered_at: string | null;
    answered_by: string | null;
    unread: boolean;
  }[];
};

export type TasksData = {
  today: string;
  status: string;
  tier: number | null;
  certified_on: string | null;
  tasks: {
    id: string;
    title: string;
    detail: string | null;
    due_on: string | null;
    completed_on: string | null;
    overdue: boolean;
    assigned_by: string | null;
  }[];
  training: {
    id: string;
    title: string;
    detail: string | null;
    completed_on: string | null;
    material: { title: string; url: string | null } | null;
  }[];
  notifications: {
    id: string;
    title: string;
    body: string;
    severity: Severity;
    created_at: string;
    read_at: string | null;
    sent_by: string | null;
  }[];
};

export type ProfileData = {
  name: string;
  email: string;
  phone: string | null;
  handle: string | null;
  country: string | null;
  time_zone: string;
  preferred_channel: string | null;
  status: string;
  tier: number | null;
  certified_on: string | null;
  joined_on: string | null;
  pay_visible: boolean;
  payout_method: string | null;
  payout_last4: string | null;
  tax_doc_status: string | null;
  mfa_enabled: boolean;
  devices: { fingerprint: string; label: string | null; first_seen_at: string; last_seen_at: string }[];
  sign_ins: { at: string; outcome: string; city: string | null; country: string | null; surface: string | null }[];
  agreements: {
    id: string;
    name: string;
    status: string;
    sent_at: string | null;
    completed_at: string | null;
    has_copy: boolean;
  }[];
};
