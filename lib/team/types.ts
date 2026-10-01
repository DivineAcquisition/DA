import type { BlockerControl, Commitment, Dispute, ShiftReview, StandardRow, StandardsData, StandardStatus } from '@/lib/portal/types';

/** Shapes returned by the staff_* accountability functions. */

export type BoardRow = {
  id: string;
  name: string;
  stage: 'applicant' | 'training' | 'waiting' | 'placed' | 'inactive';
  status: string;
  tier: number | null;
  has_account: boolean;
  placements: { id: string; client_name: string; live: boolean }[];
  standards: { key: string; label: string; status: StandardStatus; value: number | null; target: number | null; unit: string }[] | null;
  reviews_unconfirmed: number;
  reviews_open: number;
  disputes_open: number;
  blockers: Record<BlockerControl, number>;
  feedback_owed: boolean;
  self_review_ready: boolean;
  flagged_shifts: number;
  availability: number;
};

export type Queues = {
  last_week: string;
  disputes: { id: string; operator_id: string; operator_name: string; standard: string; item_label: string; item_kind: string; explanation: string; raised_at: string }[];
  blockers: { id: string; operator_id: string; operator_name: string; client_name: string; shift_date: string; control: BlockerControl; note: string; created_at: string }[];
  feedback_owed: { operator_id: string; operator_name: string; week_start: string; self_review: string | null }[];
  suspected_missed: { id: string; operator_id: string; operator_name: string; placement_id: string; client_name: string; shift_date: string; flagged_at: string }[];
  attribution: { operator_id: string; operator_name: string; placement_id: string; client_name: string; shift_date: string; ambiguous: number }[];
  tier_eligible: { operator_id: string; operator_name: string; tier: number | null; to_tier: number; eligible_at: string }[];
  formal_drafts: { id: string; operator_id: string; operator_name: string; subject: string; drafted_by: string | null; drafted_at: string }[];
};

export type Scorecard = { month: string; commitments: Commitment[] };

export type StaffStandards = Extract<StandardsData, { preview: false }> & {
  operator_id: string;
  name: string;
  stage: string;
  standards: StandardRow[];
  disputes: Dispute[];
  findings: { id: string; occurred_on: string; note: string; recorded_by: string | null }[];
  productive_time: { placement_id: string; week_start: string; minutes: number; entered_by: string | null }[];
  placements: {
    id: string;
    client_name: string;
    live: boolean;
    productive_minutes_weekly: number | null;
    exclusions: { id: string; starts_at: string; ends_at: string; kind: string; reason: string; created_by: string | null }[];
  }[];
};

export type StaffReview = Pick<ShiftReview, 'id' | 'shift_date' | 'status' | 'system' | 'reflection' | 'blockers'> & {
  placement_id: string;
  client_name: string;
  flagged: boolean;
  report: {
    conversations_handled: number;
    appointments_booked: number;
    follow_ups_completed: number;
    escalations_raised: number;
    shift_start_actual: string;
    shift_end_actual: string;
    variance_explanation: string | null;
    version: number;
  } | null;
};

export type FeedbackContext = {
  operator_id: string;
  name: string;
  week_start: string;
  self_review: { focus_line: string; submitted_at: string } | null;
  reflections: { shift_date: string; went_well: string | null; differently: string | null; in_way: string | null }[];
  standards: StandardRow[];
  history: { id: string; week_start: string; keep_doing: string; improve: string; focus: string; author: string; acknowledged_at: string | null; reply: string | null }[];
};

export type StaffNotice = {
  id: string;
  operator_id: string;
  operator_name: string;
  template_key: string;
  subject: string;
  body: string;
  status: 'draft' | 'sent' | 'cancelled';
  drafted_by: string | null;
  drafted_at: string;
  approved_by: string | null;
  sent_at: string | null;
  reply: string | null;
  replied_at: string | null;
};

export type AvailabilityRow = {
  operator_id: string;
  name: string;
  status: string;
  tier: number | null;
  certified_on: string | null;
  time_zone: string;
  windows: { iso_day: number; starts: string; ends: string }[];
};

export type AccountabilitySettings = {
  can_edit: boolean;
  team: { from_name: string; from_address: string; reply_to: string | null; base_url: string; inactive_access_months: number; updated_by: string | null; updated_at: string };
  commitments: { key: string; label: string; target_label: string; target_value: number | null; sort_order: number }[];
  tier_criteria: { id: string; tier: number; kind: string; threshold: number; label: string; sort_order: number }[];
  templates: { key: string; label: string; subject: string; body: string; urgency: string; required: boolean; sender: string; formal: boolean; updated_by: string | null; updated_at: string }[];
};
