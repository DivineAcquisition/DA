import {
  HS_CREW_COUNTS,
  HS_PHONE_COVERAGE,
  HS_TRADES,
  blankToNull,
  hsCrewCountLabel,
  hsPhoneCoverageLabel,
  hsTradeLabel,
  isHsCrewCount,
  isHsPhoneCoverage,
  isHsTrade,
  type HsCrewCount,
  type HsPhoneCoverage,
  type HsTrade,
} from '@/lib/workspace/hs-calls'

export {
  HS_CREW_COUNTS,
  HS_PHONE_COVERAGE,
  HS_TRADES,
  blankToNull,
  hsCrewCountLabel,
  hsPhoneCoverageLabel,
  hsTradeLabel,
  isHsCrewCount,
  isHsPhoneCoverage,
  isHsTrade,
}
export type { HsCrewCount, HsPhoneCoverage, HsTrade }

export const HS_COMPANY_STAGES = [
  'audit_scheduled',
  'audited',
  'proposal_sent',
  'won',
  'lost',
] as const

export type HsCompanyStage = (typeof HS_COMPANY_STAGES)[number]

export const HS_PILLAR_SCORES = ['red', 'amber', 'green'] as const
export type HsPillarScore = (typeof HS_PILLAR_SCORES)[number]

export const HS_DEBRIEF_OUTCOMES = [
  'verbal_yes',
  'thinking',
  'needs_partner',
  'not_a_fit',
  'no_decision',
] as const

export type HsDebriefOutcome = (typeof HS_DEBRIEF_OUTCOMES)[number]

export const HS_SEASON_TIMINGS = ['in_season', 'shoulder', 'off_season', 'year_round'] as const
export type HsSeasonTiming = (typeof HS_SEASON_TIMINGS)[number]

export const HS_DEBRIEF_TIMELINES = ['now', 'this_quarter', 'later', 'unknown'] as const
export type HsDebriefTimeline = (typeof HS_DEBRIEF_TIMELINES)[number]

export const HS_OBJECTION_CHIPS = [
  'Price',
  'Too busy right now / in season',
  'Wants to wait for slow season',
  'Needs to talk to partner or spouse',
  'Already has an agency',
  'Already tried something similar',
  'Does not think they have the problem',
  'Wants to see results or references first',
  'Office staff pushback',
  'Does not want more calls than crews can handle',
  'Contract length',
  'Other',
] as const

export type HsObjectionChip = (typeof HS_OBJECTION_CHIPS)[number]

export const HS_REQUIREMENT_GROUPS = ['Access', 'People', 'Assets'] as const
export type HsRequirementGroup = (typeof HS_REQUIREMENT_GROUPS)[number]

export type HsRequirementItem = {
  key: string
  label: string
  group: HsRequirementGroup
  checked: boolean
}

export const HS_REQUIREMENT_ITEMS: HsRequirementItem[] = [
  { key: 'google_ads_access', label: 'Google Ads access or written authorisation', group: 'Access', checked: false },
  { key: 'meta_business_manager', label: 'Meta Business Manager: ad account and Page', group: 'Access', checked: false },
  { key: 'google_business_profile', label: 'Google Business Profile manager access', group: 'Access', checked: false },
  { key: 'website_admin', label: 'Website admin login or developer contact', group: 'Access', checked: false },
  { key: 'crm_access', label: 'CRM access, read and write', group: 'Access', checked: false },
  { key: 'dispatch_calendar', label: 'Dispatch or scheduling calendar access', group: 'Access', checked: false },
  { key: 'crm_export_owner_named', label: 'CRM export owner named', group: 'People', checked: false },
  { key: 'dispatch_owner_named', label: 'Dispatch or scheduling owner named', group: 'People', checked: false },
  { key: 'decision_maker_confirmed', label: 'Decision maker confirmed', group: 'People', checked: false },
  { key: 'price_book', label: 'Current price book or rate sheet', group: 'Assets', checked: false },
  { key: 'financing_provider', label: 'Financing provider details', group: 'Assets', checked: false },
  { key: 'service_area', label: 'Service area and radius confirmed', group: 'Assets', checked: false },
  { key: 'licence_insurance', label: 'Licence and insurance documents', group: 'Assets', checked: false },
  { key: 'logo_brand', label: 'Logo and brand colours', group: 'Assets', checked: false },
  { key: 'job_photos', label: 'Job photos, before and after', group: 'Assets', checked: false },
  { key: 'featured_reviews', label: 'Three reviews to feature', group: 'Assets', checked: false },
]

export function seedHsRequirementItems(): HsRequirementItem[] {
  return HS_REQUIREMENT_ITEMS.map((item) => ({ ...item, checked: false }))
}

export type HsCompanyRecord = {
  id: string
  created_at: string
  updated_at: string
  call_id: string | null
  company_name: string
  contact_name: string
  trade: HsTrade
  // Gap: phone, email, city, state, and service_radius_miles have no editor
  // in this brief. They stay null unless a later form asks for them.
  phone: string | null
  email: string | null
  city: string | null
  state: string | null
  service_radius_miles: number | null
  stage: HsCompanyStage
}

export type HsAuditRecord = {
  id: string
  company_id: string
  created_at: string
  updated_at: string
  completed_at: string | null
  crm_in_use: string | null
  crew_count: HsCrewCount | null
  trucks: number | null
  who_answers_phone: HsPhoneCoverage | null
  after_hours_handling: string | null
  current_ad_spend: number | null
  current_ad_channels: string | null
  missed_calls_weekly: number | null
  avg_response_time: string | null
  existing_followup: string | null
  pillar_speed: HsPillarScore | null
  pillar_speed_note: string | null
  pillar_estimates: HsPillarScore | null
  pillar_estimates_note: string | null
  pillar_repeat: HsPillarScore | null
  pillar_repeat_note: string | null
  past_customer_count: number | null
  avg_job_value: number | null
  unsold_estimates_value: number | null
  monthly_lead_volume: number | null
  monthly_jobs_booked: number | null
  close_rate: number | null
}

export type HsDebriefRecord = {
  id: string
  company_id: string
  created_at: string
  updated_at: string
  outcome: HsDebriefOutcome | null
  biggest_leak: string | null
  their_words: string | null
  objections_raised: string[]
  objection_notes: string | null
  decision_makers: string | null
  season_timing: HsSeasonTiming | null
  timeline: HsDebriefTimeline | null
  proposed_price: number | null
  next_step: string | null
  next_step_due: string | null
  fit_rating: number | null
  would_i_take_them: boolean | null
  notes: string | null
}

export type HsRequirementsRecord = {
  id: string
  company_id: string
  created_at: string
  updated_at: string
  sent_at: string | null
  due_at: string | null
  items: HsRequirementItem[]
  crm_export_owner_name: string | null
  crm_export_owner_email: string | null
  crm_export_owner_phone: string | null
  dispatch_owner_name: string | null
  decision_maker_name: string | null
}

export type HsFormDot = 'empty' | 'started' | 'complete'

export type HsCompanyListRow = HsCompanyRecord & {
  idle_revenue: number | null
}

export type HsAuditDraft = Omit<
  HsAuditRecord,
  'id' | 'company_id' | 'created_at' | 'updated_at' | 'completed_at'
>

export type HsDebriefDraft = Omit<HsDebriefRecord, 'id' | 'company_id' | 'created_at' | 'updated_at'>

export type HsRequirementDraft = {
  items: HsRequirementItem[]
  crm_export_owner_name: string | null
  crm_export_owner_email: string | null
  crm_export_owner_phone: string | null
  dispatch_owner_name: string | null
  decision_maker_name: string | null
}

export function isHsCompanyStage(value: string): value is HsCompanyStage {
  return (HS_COMPANY_STAGES as readonly string[]).includes(value)
}

export function isHsPillarScore(value: string): value is HsPillarScore {
  return (HS_PILLAR_SCORES as readonly string[]).includes(value)
}

export function isHsDebriefOutcome(value: string): value is HsDebriefOutcome {
  return (HS_DEBRIEF_OUTCOMES as readonly string[]).includes(value)
}

export function isHsSeasonTiming(value: string): value is HsSeasonTiming {
  return (HS_SEASON_TIMINGS as readonly string[]).includes(value)
}

export function isHsDebriefTimeline(value: string): value is HsDebriefTimeline {
  return (HS_DEBRIEF_TIMELINES as readonly string[]).includes(value)
}

export function hsCompanyStageLabel(stage: HsCompanyStage): string {
  switch (stage) {
    case 'audit_scheduled':
      return 'Audit scheduled'
    case 'audited':
      return 'Audited'
    case 'proposal_sent':
      return 'Proposal sent'
    case 'won':
      return 'Won'
    case 'lost':
      return 'Lost'
  }
}

export function hsCompanyStageColor(stage: HsCompanyStage): string {
  switch (stage) {
    case 'audit_scheduled':
      return '#6E6C80'
    case 'audited':
      return '#FFD06A'
    case 'proposal_sent':
      return '#937DFF'
    case 'won':
      return '#7AFF8A'
    case 'lost':
      return '#FF6A6A'
  }
}

export function hsDebriefOutcomeLabel(outcome: HsDebriefOutcome): string {
  switch (outcome) {
    case 'verbal_yes':
      return 'Verbal yes'
    case 'thinking':
      return 'Thinking about it'
    case 'needs_partner':
      return 'Needs to talk to a partner'
    case 'not_a_fit':
      return 'Not a fit'
    case 'no_decision':
      return 'No clear decision'
  }
}

export function hsSeasonTimingLabel(timing: HsSeasonTiming): string {
  switch (timing) {
    case 'in_season':
      return 'In season'
    case 'shoulder':
      return 'Shoulder season'
    case 'off_season':
      return 'Off season'
    case 'year_round':
      return 'Year round'
  }
}

export function hsDebriefTimelineLabel(timeline: HsDebriefTimeline): string {
  switch (timeline) {
    case 'now':
      return 'Now'
    case 'this_quarter':
      return 'This quarter'
    case 'later':
      return 'Later'
    case 'unknown':
      return 'Unknown'
  }
}

export function hsPillarColor(score: HsPillarScore): string {
  switch (score) {
    case 'red':
      return '#FF6A6A'
    case 'amber':
      return '#FFD06A'
    case 'green':
      return '#7AFF8A'
  }
}

export function hsFormDotColor(dot: HsFormDot): string {
  switch (dot) {
    case 'empty':
      return '#6E6C80'
    case 'started':
      return '#FFD06A'
    case 'complete':
      return '#7AFF8A'
  }
}

export function hsAuditFormDot(audit: Pick<HsAuditRecord, 'completed_at'> | null): HsFormDot {
  if (!audit) return 'empty'
  return audit.completed_at ? 'complete' : 'started'
}

export function hsDebriefFormDot(debrief: Pick<HsDebriefRecord, 'outcome'> | null): HsFormDot {
  if (!debrief) return 'empty'
  return debrief.outcome ? 'complete' : 'started'
}

export function hsRequirementsFormDot(
  requirements: Pick<HsRequirementsRecord, 'items'> | null,
): HsFormDot {
  if (!requirements) return 'empty'
  const items = requirements.items.length > 0 ? requirements.items : HS_REQUIREMENT_ITEMS
  return items.every((item) => item.checked) ? 'complete' : 'started'
}

/** Null inputs count as zero. No figure unless at least one of the three is non-null. */
export function computeIdleRevenue(
  pastCustomerCount: number | null | undefined,
  avgJobValue: number | null | undefined,
  unsoldEstimatesValue: number | null | undefined,
): number | null {
  if (pastCustomerCount == null && avgJobValue == null && unsoldEstimatesValue == null) {
    return null
  }
  return (pastCustomerCount ?? 0) * (avgJobValue ?? 0) + (unsoldEstimatesValue ?? 0)
}

export function idleRevenueFromAudit(
  audit: Pick<HsAuditRecord, 'past_customer_count' | 'avg_job_value' | 'unsold_estimates_value'> | null,
): number | null {
  if (!audit) return null
  return computeIdleRevenue(audit.past_customer_count, audit.avg_job_value, audit.unsold_estimates_value)
}

export function computeLeadToJobGap(
  monthlyLeadVolume: number | null | undefined,
  monthlyJobsBooked: number | null | undefined,
): number | null {
  if (monthlyLeadVolume == null || monthlyJobsBooked == null) return null
  return monthlyLeadVolume - monthlyJobsBooked
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return formatUsd(value)
}

export function formatIdleRevenue(input: {
  past_customer_count: number | null
  avg_job_value: number | null
  unsold_estimates_value: number | null
}): string {
  const value = computeIdleRevenue(
    input.past_customer_count,
    input.avg_job_value,
    input.unsold_estimates_value,
  )
  if (value == null) return '—'
  return formatUsd(value)
}

export function formatNumberInput(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatUsdInput(value: number | null): string {
  return formatNumberInput(value)
}

export function parseNumeric(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null
  const n =
    typeof raw === 'number' ? raw : Number(String(raw).replace(/[$,%\s]/g, '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

export function parseInteger(raw: string | number | null | undefined): number | null {
  const n = parseNumeric(raw)
  if (n == null) return null
  return Math.trunc(n)
}

export function parseUsdInput(raw: string): number | null {
  return parseNumeric(raw)
}

export function parseNumberInput(raw: string): number | null {
  return parseNumeric(raw)
}

export function formatPercentInput(value: number | null): string {
  if (value == null) return ''
  return String(value)
}

export function parsePercentInput(raw: string): number | null {
  const n = parseNumeric(raw)
  if (n == null) return null
  return Math.min(100, Math.max(0, n))
}

export function mergeHsRequirementItems(saved: unknown): HsRequirementItem[] {
  const byKey = new Map<string, boolean>()
  if (Array.isArray(saved)) {
    for (const row of saved) {
      if (!row || typeof row !== 'object') continue
      const rec = row as Record<string, unknown>
      if (typeof rec.key === 'string') byKey.set(rec.key, Boolean(rec.checked))
    }
  }
  return HS_REQUIREMENT_ITEMS.map((item) => ({
    ...item,
    checked: byKey.get(item.key) ?? false,
  }))
}

export function hsRequirementsCheckedCount(items: HsRequirementItem[]): { checked: number; total: number } {
  return { checked: items.filter((item) => item.checked).length, total: items.length }
}

export function hsAuditComplete(audit: { completed_at: string | null } | null): boolean {
  return Boolean(audit?.completed_at)
}

export function hsDebriefComplete(debrief: { outcome: string | null } | null): boolean {
  return Boolean(debrief?.outcome)
}

export function hsRequirementsComplete(items: HsRequirementItem[] | null | undefined): boolean {
  if (!items || items.length === 0) return false
  return items.every((item) => item.checked)
}

export function hsFormStatus(saved: boolean, complete: boolean): HsFormDot {
  if (!saved) return 'empty'
  if (complete) return 'complete'
  return 'started'
}

export function hsStageAfterDebriefOutcome(outcome: HsDebriefOutcome): HsCompanyStage | null {
  if (outcome === 'verbal_yes') return 'proposal_sent'
  if (outcome === 'not_a_fit') return 'lost'
  return null
}

/** Pipeline rank. Won and lost are both terminal so they do not overwrite each other. */
export function hsStageRank(stage: HsCompanyStage): number {
  switch (stage) {
    case 'audit_scheduled':
      return 0
    case 'audited':
      return 1
    case 'proposal_sent':
      return 2
    case 'won':
    case 'lost':
      return 3
  }
}

export function hsStageWouldAdvance(current: HsCompanyStage, next: HsCompanyStage): boolean {
  return hsStageRank(next) > hsStageRank(current)
}

export function hsRequirementsDueAt(sentAt: Date): Date {
  return new Date(sentAt.getTime() + 72 * 60 * 60 * 1000)
}

export function remainingLabel(dueAt: string, nowMs = Date.now()): { text: string; overdue: boolean } {
  const due = new Date(dueAt).getTime()
  if (Number.isNaN(due)) return { text: '—', overdue: false }
  const diff = due - nowMs
  if (diff <= 0) return { text: 'Overdue', overdue: true }
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0) return { text: `${days}d ${remHours}h remaining`, overdue: false }
  if (hours > 0) return { text: `${hours}h ${minutes}m remaining`, overdue: false }
  return { text: `${Math.max(1, minutes)}m remaining`, overdue: false }
}

export function formatHsCountdown(dueAtIso: string, now = new Date()): { label: string; overdue: boolean } {
  const result = remainingLabel(dueAtIso, now.getTime())
  return { label: result.text, overdue: result.overdue }
}

export function hsMatchesNameSearch(companyName: string, contactName: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return companyName.toLowerCase().includes(q) || contactName.toLowerCase().includes(q)
}

export function emptyHsAuditDraft(): HsAuditDraft {
  return {
    crm_in_use: null,
    crew_count: null,
    trucks: null,
    who_answers_phone: null,
    after_hours_handling: null,
    current_ad_spend: null,
    current_ad_channels: null,
    missed_calls_weekly: null,
    avg_response_time: null,
    existing_followup: null,
    pillar_speed: null,
    pillar_speed_note: null,
    pillar_estimates: null,
    pillar_estimates_note: null,
    pillar_repeat: null,
    pillar_repeat_note: null,
    past_customer_count: null,
    avg_job_value: null,
    unsold_estimates_value: null,
    monthly_lead_volume: null,
    monthly_jobs_booked: null,
    close_rate: null,
  }
}

export function emptyHsDebriefDraft(): HsDebriefDraft {
  return {
    outcome: null,
    biggest_leak: null,
    their_words: null,
    objections_raised: [],
    objection_notes: null,
    decision_makers: null,
    season_timing: null,
    timeline: null,
    proposed_price: null,
    next_step: null,
    next_step_due: null,
    fit_rating: null,
    would_i_take_them: null,
    notes: null,
  }
}

export function emptyHsRequirementDraft(): HsRequirementDraft {
  return {
    items: seedHsRequirementItems(),
    crm_export_owner_name: null,
    crm_export_owner_email: null,
    crm_export_owner_phone: null,
    dispatch_owner_name: null,
    decision_maker_name: null,
  }
}

export function hsAuditDraftFrom(audit: HsAuditRecord | null): HsAuditDraft {
  if (!audit) return emptyHsAuditDraft()
  return {
    crm_in_use: audit.crm_in_use,
    crew_count: audit.crew_count,
    trucks: audit.trucks,
    who_answers_phone: audit.who_answers_phone,
    after_hours_handling: audit.after_hours_handling,
    current_ad_spend: audit.current_ad_spend,
    current_ad_channels: audit.current_ad_channels,
    missed_calls_weekly: audit.missed_calls_weekly,
    avg_response_time: audit.avg_response_time,
    existing_followup: audit.existing_followup,
    pillar_speed: audit.pillar_speed,
    pillar_speed_note: audit.pillar_speed_note,
    pillar_estimates: audit.pillar_estimates,
    pillar_estimates_note: audit.pillar_estimates_note,
    pillar_repeat: audit.pillar_repeat,
    pillar_repeat_note: audit.pillar_repeat_note,
    past_customer_count: audit.past_customer_count,
    avg_job_value: audit.avg_job_value,
    unsold_estimates_value: audit.unsold_estimates_value,
    monthly_lead_volume: audit.monthly_lead_volume,
    monthly_jobs_booked: audit.monthly_jobs_booked,
    close_rate: audit.close_rate,
  }
}

export function hsDebriefDraftFrom(debrief: HsDebriefRecord | null): HsDebriefDraft {
  if (!debrief) return emptyHsDebriefDraft()
  return {
    outcome: debrief.outcome,
    biggest_leak: debrief.biggest_leak,
    their_words: debrief.their_words,
    objections_raised: [...debrief.objections_raised],
    objection_notes: debrief.objection_notes,
    decision_makers: debrief.decision_makers,
    season_timing: debrief.season_timing,
    timeline: debrief.timeline,
    proposed_price: debrief.proposed_price,
    next_step: debrief.next_step,
    next_step_due: debrief.next_step_due,
    fit_rating: debrief.fit_rating,
    would_i_take_them: debrief.would_i_take_them,
    notes: debrief.notes,
  }
}

export function hsRequirementDraftFrom(row: HsRequirementsRecord | null): HsRequirementDraft {
  if (!row) return emptyHsRequirementDraft()
  return {
    items: mergeHsRequirementItems(row.items),
    crm_export_owner_name: row.crm_export_owner_name,
    crm_export_owner_email: row.crm_export_owner_email,
    crm_export_owner_phone: row.crm_export_owner_phone,
    dispatch_owner_name: row.dispatch_owner_name,
    decision_maker_name: row.decision_maker_name,
  }
}
