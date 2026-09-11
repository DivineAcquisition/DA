import {
  FRONT_DESK_SIZES,
  PRACTICE_TYPES,
  type FrontDeskSize,
  type PracticeType,
} from './calls';

export { FRONT_DESK_SIZES, PRACTICE_TYPES, type FrontDeskSize, type PracticeType };

export const PRACTICE_STAGES = [
  'audit_scheduled',
  'audited',
  'proposal_sent',
  'won',
  'lost',
] as const;
export type PracticeStage = (typeof PRACTICE_STAGES)[number];

export const PILLAR_SCORES = ['red', 'amber', 'green'] as const;
export type PillarScore = (typeof PILLAR_SCORES)[number];

export const DEBRIEF_OUTCOMES = [
  'verbal_yes',
  'thinking',
  'needs_partner',
  'not_a_fit',
  'no_decision',
] as const;
export type DebriefOutcome = (typeof DEBRIEF_OUTCOMES)[number];

export const DEBRIEF_TIMELINES = ['now', 'this_quarter', 'later', 'unknown'] as const;
export type DebriefTimeline = (typeof DEBRIEF_TIMELINES)[number];

export const OBJECTION_CHIPS = [
  'Price',
  'Timing / too busy right now',
  'Needs to talk to partner or spouse',
  'Already has an agency',
  'Already tried something similar',
  'Does not think they have the problem',
  'Wants to see results or references first',
  'Front desk pushback',
  'Contract length',
  'Other',
] as const;
export type ObjectionChip = (typeof OBJECTION_CHIPS)[number];

export type RequirementGroup = 'Access' | 'People' | 'Assets';

export type RequirementItem = {
  key: string;
  label: string;
  group: RequirementGroup;
  checked: boolean;
};

export const REQUIREMENT_ITEMS: RequirementItem[] = [
  { key: 'google_ads', label: 'Google Ads access or written authorisation', group: 'Access', checked: false },
  { key: 'meta_bm', label: 'Meta Business Manager: ad account, Page, Instagram', group: 'Access', checked: false },
  { key: 'gbp', label: 'Google Business Profile manager access', group: 'Access', checked: false },
  { key: 'website', label: 'Website admin login or developer contact', group: 'Access', checked: false },
  { key: 'calendar', label: 'Practice calendar access for two-way sync', group: 'Access', checked: false },
  { key: 'pms_export_named', label: 'PMS export owner named', group: 'People', checked: false },
  { key: 'front_desk_named', label: 'Front desk lead named', group: 'People', checked: false },
  { key: 'decision_maker_confirmed', label: 'Decision maker confirmed', group: 'People', checked: false },
  { key: 'pricing', label: 'Current pricing sheet', group: 'Assets', checked: false },
  { key: 'financing', label: 'Financing provider details', group: 'Assets', checked: false },
  { key: 'photos', label: 'Before and after photo library with consent', group: 'Assets', checked: false },
  { key: 'brand', label: 'Logo and brand colours', group: 'Assets', checked: false },
  { key: 'bio', label: 'Provider bio and headshot', group: 'Assets', checked: false },
  { key: 'reviews', label: 'Three reviews to feature', group: 'Assets', checked: false },
];

export const REQUIREMENT_GROUPS: RequirementGroup[] = ['Access', 'People', 'Assets'];

export type PracticeRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  call_id: string | null;
  practice_name: string;
  contact_name: string;
  practice_type: PracticeType;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  stage: PracticeStage;
};

export type AuditRecord = {
  id: string;
  practice_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  pms_in_use: string | null;
  front_desk_size: FrontDeskSize | null;
  operatories: number | null;
  current_ad_spend: number | null;
  current_ad_channels: string | null;
  phone_owner: string | null;
  missed_calls_weekly: number | null;
  existing_followup: string | null;
  pillar_acquisition: PillarScore | null;
  pillar_acquisition_note: string | null;
  pillar_reactivation: PillarScore | null;
  pillar_reactivation_note: string | null;
  pillar_showup: PillarScore | null;
  pillar_showup_note: string | null;
  recall_list_size: number | null;
  avg_hygiene_value: number | null;
  unscheduled_treatment_value: number | null;
  avg_new_patient_value: number | null;
  current_no_show_rate: number | null;
  monthly_new_patients: number | null;
};

export type DebriefRecord = {
  id: string;
  practice_id: string;
  created_at: string;
  updated_at: string;
  outcome: DebriefOutcome | null;
  biggest_leak: string | null;
  their_words: string | null;
  objections_raised: string[];
  objection_notes: string | null;
  decision_makers: string | null;
  timeline: DebriefTimeline | null;
  proposed_price: number | null;
  next_step: string | null;
  next_step_due: string | null;
  fit_rating: number | null;
  would_i_take_them: boolean | null;
  notes: string | null;
};

export type RequirementsRecord = {
  id: string;
  practice_id: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  due_at: string | null;
  items: RequirementItem[];
  pms_export_owner_name: string | null;
  pms_export_owner_email: string | null;
  pms_export_owner_phone: string | null;
  front_desk_owner_name: string | null;
  decision_maker_name: string | null;
};

export type FormDot = 'empty' | 'started' | 'complete';

export type PracticeListRow = PracticeRecord & {
  dormant_revenue: number | null;
};

export function isPracticeStage(value: string): value is PracticeStage {
  return (PRACTICE_STAGES as readonly string[]).includes(value);
}

export function isPillarScore(value: string): value is PillarScore {
  return (PILLAR_SCORES as readonly string[]).includes(value);
}

export function isDebriefOutcome(value: string): value is DebriefOutcome {
  return (DEBRIEF_OUTCOMES as readonly string[]).includes(value);
}

export function isDebriefTimeline(value: string): value is DebriefTimeline {
  return (DEBRIEF_TIMELINES as readonly string[]).includes(value);
}

export function isFrontDeskSize(value: string): value is FrontDeskSize {
  return (FRONT_DESK_SIZES as readonly string[]).includes(value);
}

export function practiceStageLabel(stage: PracticeStage): string {
  switch (stage) {
    case 'audit_scheduled':
      return 'Audit scheduled';
    case 'audited':
      return 'Audited';
    case 'proposal_sent':
      return 'Proposal sent';
    case 'won':
      return 'Won';
    case 'lost':
      return 'Lost';
  }
}

export function practiceStageColor(stage: PracticeStage): string {
  switch (stage) {
    case 'audit_scheduled':
      return '#6E6C80';
    case 'audited':
      return '#FFD06A';
    case 'proposal_sent':
      return '#937DFF';
    case 'won':
      return '#7AFF8A';
    case 'lost':
      return '#FF6A6A';
  }
}

export function practiceStageAfterDebriefOutcome(outcome: DebriefOutcome): PracticeStage | null {
  if (outcome === 'verbal_yes') return 'proposal_sent';
  if (outcome === 'not_a_fit') return 'lost';
  return null;
}

/** Pipeline rank. Won and lost are both terminal so they do not overwrite each other. */
export function practiceStageRank(stage: PracticeStage): number {
  switch (stage) {
    case 'audit_scheduled':
      return 0;
    case 'audited':
      return 1;
    case 'proposal_sent':
      return 2;
    case 'won':
    case 'lost':
      return 3;
  }
}

export function practiceStageWouldAdvance(current: PracticeStage, next: PracticeStage): boolean {
  return practiceStageRank(next) > practiceStageRank(current);
}

export function debriefOutcomeLabel(outcome: DebriefOutcome): string {
  switch (outcome) {
    case 'verbal_yes':
      return 'Verbal yes';
    case 'thinking':
      return 'Thinking about it';
    case 'needs_partner':
      return 'Needs to talk to a partner';
    case 'not_a_fit':
      return 'Not a fit';
    case 'no_decision':
      return 'No clear decision';
  }
}

export function debriefTimelineLabel(timeline: DebriefTimeline): string {
  switch (timeline) {
    case 'now':
      return 'Now';
    case 'this_quarter':
      return 'This quarter';
    case 'later':
      return 'Later';
    case 'unknown':
      return 'Unknown';
  }
}

export function pillarColor(score: PillarScore): string {
  switch (score) {
    case 'red':
      return '#FF6A6A';
    case 'amber':
      return '#FFD06A';
    case 'green':
      return '#7AFF8A';
  }
}

export function formDotColor(dot: FormDot): string {
  switch (dot) {
    case 'empty':
      return '#6E6C80';
    case 'started':
      return '#FFD06A';
    case 'complete':
      return '#7AFF8A';
  }
}

export function auditFormDot(audit: Pick<AuditRecord, 'completed_at'> | null): FormDot {
  if (!audit) return 'empty';
  return audit.completed_at ? 'complete' : 'started';
}

export function debriefFormDot(debrief: Pick<DebriefRecord, 'outcome'> | null): FormDot {
  if (!debrief) return 'empty';
  return debrief.outcome ? 'complete' : 'started';
}

export function requirementsFormDot(requirements: Pick<RequirementsRecord, 'items'> | null): FormDot {
  if (!requirements) return 'empty';
  const items = requirements.items.length > 0 ? requirements.items : REQUIREMENT_ITEMS;
  return items.every((item) => item.checked) ? 'complete' : 'started';
}

/** Null inputs count as zero. No figure unless at least one of the three is non-null. */
export function dormantRevenue(input: {
  recall_list_size: number | null;
  avg_hygiene_value: number | null;
  unscheduled_treatment_value: number | null;
}): number | null {
  const recall = input.recall_list_size;
  const visit = input.avg_hygiene_value;
  const unscheduled = input.unscheduled_treatment_value;
  if (recall == null && visit == null && unscheduled == null) return null;
  return (recall ?? 0) * (visit ?? 0) + (unscheduled ?? 0);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyInput(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 2,
  }).format(value);
}

export function parseNumeric(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[$,%\s]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseInteger(raw: string | number | null | undefined): number | null {
  const n = parseNumeric(raw);
  if (n == null) return null;
  return Math.trunc(n);
}

export function mergeRequirementItems(saved: unknown): RequirementItem[] {
  const byKey = new Map<string, boolean>();
  if (Array.isArray(saved)) {
    for (const row of saved) {
      if (!row || typeof row !== 'object') continue;
      const rec = row as Record<string, unknown>;
      if (typeof rec.key === 'string') byKey.set(rec.key, Boolean(rec.checked));
    }
  }
  return REQUIREMENT_ITEMS.map((item) => ({
    ...item,
    checked: byKey.get(item.key) ?? false,
  }));
}

export function requirementsCheckedCount(items: RequirementItem[]): { checked: number; total: number } {
  return { checked: items.filter((item) => item.checked).length, total: items.length };
}

export function matchesPracticeSearch(
  row: Pick<PracticeRecord, 'practice_name' | 'contact_name'>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return row.practice_name.toLowerCase().includes(q) || row.contact_name.toLowerCase().includes(q);
}

export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

export function remainingLabel(dueAt: string, nowMs = Date.now()): { text: string; overdue: boolean } {
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return { text: '—', overdue: false };
  const diff = due - nowMs;
  if (diff <= 0) return { text: 'Overdue', overdue: true };
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return { text: `${days}d ${remHours}h remaining`, overdue: false };
  if (hours > 0) return { text: `${hours}h ${minutes}m remaining`, overdue: false };
  return { text: `${Math.max(1, minutes)}m remaining`, overdue: false };
}

export function formatDormantRevenue(input: {
  recall_list_size: number | null;
  avg_hygiene_value: number | null;
  unscheduled_treatment_value: number | null;
}): string {
  const value = dormantRevenue(input);
  if (value == null) return '—';
  return formatCurrency(value);
}

export function currencyDisplay(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatNumberInput(value: number | null | undefined): string {
  return formatCurrencyInput(value);
}

export function parseNumberInput(raw: string): number | null {
  return parseNumeric(raw);
}

export function percentDisplay(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return `${value}%`;
}

export function parsePercentInput(raw: string): number | null {
  const n = parseNumeric(raw);
  if (n == null) return null;
  return Math.min(100, Math.max(0, n));
}

export function isRequirementComplete(items: RequirementItem[]): boolean {
  return items.length > 0 && items.every((item) => item.checked);
}

export function tabDot(input: { exists: boolean; complete: boolean }): FormDot {
  if (!input.exists) return 'empty';
  return input.complete ? 'complete' : 'started';
}

export type AuditDraft = Omit<
  AuditRecord,
  'id' | 'practice_id' | 'created_at' | 'updated_at' | 'completed_at'
>;

export type DebriefDraft = Omit<DebriefRecord, 'id' | 'practice_id' | 'created_at' | 'updated_at'>;

export type RequirementDraft = {
  items: RequirementItem[];
  pms_export_owner_name: string | null;
  pms_export_owner_email: string | null;
  pms_export_owner_phone: string | null;
  front_desk_owner_name: string | null;
  decision_maker_name: string | null;
};

export function emptyAuditDraft(): AuditDraft {
  return {
    pms_in_use: null,
    front_desk_size: null,
    operatories: null,
    current_ad_spend: null,
    current_ad_channels: null,
    phone_owner: null,
    missed_calls_weekly: null,
    existing_followup: null,
    pillar_acquisition: null,
    pillar_acquisition_note: null,
    pillar_reactivation: null,
    pillar_reactivation_note: null,
    pillar_showup: null,
    pillar_showup_note: null,
    recall_list_size: null,
    avg_hygiene_value: null,
    unscheduled_treatment_value: null,
    avg_new_patient_value: null,
    current_no_show_rate: null,
    monthly_new_patients: null,
  };
}

export function emptyDebriefDraft(): DebriefDraft {
  return {
    outcome: null,
    biggest_leak: null,
    their_words: null,
    objections_raised: [],
    objection_notes: null,
    decision_makers: null,
    timeline: null,
    proposed_price: null,
    next_step: null,
    next_step_due: null,
    fit_rating: null,
    would_i_take_them: null,
    notes: null,
  };
}

export function emptyRequirementDraft(): RequirementDraft {
  return {
    items: REQUIREMENT_ITEMS.map((item) => ({ ...item })),
    pms_export_owner_name: null,
    pms_export_owner_email: null,
    pms_export_owner_phone: null,
    front_desk_owner_name: null,
    decision_maker_name: null,
  };
}

export function auditDraftFrom(audit: AuditRecord | null): AuditDraft {
  if (!audit) return emptyAuditDraft();
  return {
    pms_in_use: audit.pms_in_use,
    front_desk_size: audit.front_desk_size,
    operatories: audit.operatories,
    current_ad_spend: audit.current_ad_spend,
    current_ad_channels: audit.current_ad_channels,
    phone_owner: audit.phone_owner,
    missed_calls_weekly: audit.missed_calls_weekly,
    existing_followup: audit.existing_followup,
    pillar_acquisition: audit.pillar_acquisition,
    pillar_acquisition_note: audit.pillar_acquisition_note,
    pillar_reactivation: audit.pillar_reactivation,
    pillar_reactivation_note: audit.pillar_reactivation_note,
    pillar_showup: audit.pillar_showup,
    pillar_showup_note: audit.pillar_showup_note,
    recall_list_size: audit.recall_list_size,
    avg_hygiene_value: audit.avg_hygiene_value,
    unscheduled_treatment_value: audit.unscheduled_treatment_value,
    avg_new_patient_value: audit.avg_new_patient_value,
    current_no_show_rate: audit.current_no_show_rate,
    monthly_new_patients: audit.monthly_new_patients,
  };
}

export function debriefDraftFrom(debrief: DebriefRecord | null): DebriefDraft {
  if (!debrief) return emptyDebriefDraft();
  return {
    outcome: debrief.outcome,
    biggest_leak: debrief.biggest_leak,
    their_words: debrief.their_words,
    objections_raised: [...debrief.objections_raised],
    objection_notes: debrief.objection_notes,
    decision_makers: debrief.decision_makers,
    timeline: debrief.timeline,
    proposed_price: debrief.proposed_price,
    next_step: debrief.next_step,
    next_step_due: debrief.next_step_due,
    fit_rating: debrief.fit_rating,
    would_i_take_them: debrief.would_i_take_them,
    notes: debrief.notes,
  };
}

export function requirementDraftFrom(row: RequirementsRecord | null): RequirementDraft {
  if (!row) return emptyRequirementDraft();
  return {
    items: mergeRequirementItems(row.items),
    pms_export_owner_name: row.pms_export_owner_name,
    pms_export_owner_email: row.pms_export_owner_email,
    pms_export_owner_phone: row.pms_export_owner_phone,
    front_desk_owner_name: row.front_desk_owner_name,
    decision_maker_name: row.decision_maker_name,
  };
}
