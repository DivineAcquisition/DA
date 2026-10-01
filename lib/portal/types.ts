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

/** Where the VA is: from their operator status plus whether a placement is live. */
export type Stage = 'applicant' | 'training' | 'waiting' | 'placed' | 'inactive';

export type PortalContext = {
  operator: {
    id: string;
    name: string;
    first_name: string;
    time_zone: string;
    status: string;
    tier?: number | null;
    certified_on?: string | null;
    email_optional?: boolean;
  };
  stage: Stage;
  has_history: boolean;
  has_pay: boolean;
  inactive_until: string | null;
  focus: { text: string; week_start: string; author: string } | null;
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
    reviews_open?: number;
    reviews_unconfirmed?: number;
    feedback_unread?: number;
    formal_notices?: number;
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

// Prompt 8: the accountability system --------------------------------------------

/** What the system recorded in a window. A null count means "not captured". */
export type ActivityCounts = {
  tracking: boolean;
  conversations: number | null;
  touches_outbound: number | null;
  touches_inbound: number | null;
  touches_by_channel: Record<string, number> | null;
  follow_ups: number | null;
  appointments_booked: number;
  escalations_raised: number;
  leads_in: number | null;
  responded_in_standard: number | null;
  median_response_minutes: number | null;
  first_activity_at: string | null;
  last_activity_at: string | null;
  ambiguous: number;
  response_standard_minutes: number;
};

export type LiveData = {
  placement_id: string;
  live: boolean;
  on_shift?: boolean;
  shift?: Window | null;
  tracking?: boolean;
  response_standard_minutes?: number;
  clock?: { waiting: number; over_standard: number; oldest_minutes: number | null } | null;
  so_far?: ActivityCounts | null;
  reviews?: { shift_date: string; status: 'open' | 'unconfirmed'; confirm_by: string | null }[];
};

export type BlockerControl = 'mine' | 'client' | 'da' | 'outside';

export type ShiftReview = {
  id: string;
  shift_date: string;
  starts_at: string;
  ends_at: string;
  status: 'open' | 'confirmed' | 'unconfirmed';
  confirm_by: string | null;
  confirmed_at: string | null;
  period_closed: boolean;
  system: ActivityCounts;
  captured_start: string | null;
  captured_end: string | null;
  report: {
    id: string;
    version: number;
    conversations_handled: number;
    appointments_booked: number;
    follow_ups_completed: number;
    escalations_raised: number;
    shift_start_actual: string;
    shift_end_actual: string;
    variance_explanation: string | null;
    correction_reason: string | null;
    notes: string | null;
    submitted_at: string;
  } | null;
  reflection: { went_well: string | null; differently: string | null; in_way: string | null };
  blockers: { id: string; control: BlockerControl; note: string; resolved_at: string | null; resolution: string | null }[];
};

export type ReviewsData = { placement_id: string; time_zone: string; reviews: ShiftReview[] };

export type StandardStatus = 'on_track' | 'at_risk' | 'below' | 'not_measured';

export type StandardRow = {
  key: string;
  label: string;
  unit: string;
  direction: 'up_is_good' | 'down_is_good';
  target: number | null;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  measured: boolean;
  status: StandardStatus;
  section: string | null;
  how: string;
  note: string | null;
};

export type Dispute = {
  id: string;
  standard_key: string;
  item_kind: string;
  item_id: string;
  item_label: string | null;
  explanation: string;
  status: 'open' | 'approved' | 'declined';
  raised_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
};

export type StandardsData =
  | { preview: true; definitions: { key: string; label: string; unit: string; target: number | null; section: string | null; how: string }[] }
  | {
      preview: false;
      month: string;
      finished: boolean;
      standards: StandardRow[];
      trend: { month: string; rows: Record<string, { value: number | null; status: StandardStatus }> | null }[];
      disputes: Dispute[];
    };

export type StandardItem = {
  id: string;
  placement_id?: string;
  at?: string;
  date?: string;
  label?: string;
  status?: string;
  state?: string;
  response_minutes?: number | null;
  minutes?: number;
  threshold?: number | null;
  met: boolean;
  counted: boolean;
  excluded_reason?: string | null;
  recorded_by?: string | null;
  late_notice?: boolean;
};

export type StandardItems = { kind: 'lead' | 'shift' | 'booking' | 'finding' | 'week' | 'none'; items: StandardItem[] };

export type Commitment = {
  key: string;
  label: string;
  target: string;
  target_value: number | null;
  total: number;
  on_time: number;
  rate: number | null;
  misses: { at: string; text: string; link: string; operator_name?: string }[];
  detail: string | null;
};

export type CommitmentsData = { month: string; commitments: Commitment[] };

export type Feedback = {
  id: string;
  week_start: string;
  keep_doing: string;
  improve: string;
  focus: string;
  author: string;
  posted_at: string;
  acknowledged_at: string | null;
  reply: string | null;
  replied_at: string | null;
};

export type GrowthData = {
  tier: number | null;
  certified_on: string | null;
  progress: {
    tier: number | null;
    next_tier: number | null;
    eligible: boolean;
    criteria: { id: string; kind: string; label: string; threshold: number; current: number; met: boolean }[];
  };
  decisions: { from_tier: number | null; to_tier: number; decision: 'approved' | 'declined'; reason: string; decided_by: string | null; decided_at: string }[];
  feedback: Feedback[];
  week_start: string;
  self_review: { week_start: string; focus_line: string; submitted_at: string } | null;
  self_reviews: { week_start: string; focus_line: string }[];
  week_summary: {
    bookings: number;
    shifts_worked: number;
    reviews_confirmed: number;
    reflections: { shift_date: string; went_well: string | null; differently: string | null; in_way: string | null }[];
  };
};

export type AvailabilityWindow = { iso_day: number; starts: string; ends: string };

export type AvailabilityData = { time_zone: string; windows: AvailabilityWindow[]; updated_at: string | null };

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  kind: string;
  urgency: 'immediate' | 'normal';
  link: string | null;
  required: boolean;
  created_at: string;
  read_at: string | null;
  sent_by: string | null;
  emailed: boolean;
};

export type FormalNotice = {
  id: string;
  subject: string;
  body: string;
  sent_at: string;
  sent_by: string | null;
  reply: string | null;
  replied_at: string | null;
};
