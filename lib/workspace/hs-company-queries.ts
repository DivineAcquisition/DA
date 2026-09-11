import { requireAdmin, workspaceClient } from './db'
import {
  computeIdleRevenue,
  isHsCompanyStage,
  isHsCrewCount,
  isHsDebriefOutcome,
  isHsDebriefTimeline,
  isHsPhoneCoverage,
  isHsPillarScore,
  isHsSeasonTiming,
  isHsTrade,
  mergeHsRequirementItems,
  type HsAuditRecord,
  type HsCompanyListRow,
  type HsCompanyRecord,
  type HsDebriefRecord,
  type HsRequirementsRecord,
} from './hs-companies'

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function asInteger(value: unknown): number | null {
  const n = asNumber(value)
  return n == null ? null : Math.trunc(n)
}

function asString(value: unknown): string | null {
  if (value == null) return null
  const text = String(value)
  return text.length ? text : null
}

function asCompany(row: Record<string, unknown>): HsCompanyRecord {
  const stage = isHsCompanyStage(String(row.stage ?? '')) ? row.stage : 'audit_scheduled'
  const trade = isHsTrade(String(row.trade ?? '')) ? row.trade : 'other'
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    call_id: asString(row.call_id),
    company_name: String(row.company_name ?? ''),
    contact_name: String(row.contact_name ?? ''),
    trade: trade as HsCompanyRecord['trade'],
    phone: asString(row.phone),
    email: asString(row.email),
    city: asString(row.city),
    state: asString(row.state),
    service_radius_miles: asInteger(row.service_radius_miles),
    stage: stage as HsCompanyRecord['stage'],
  }
}

function asAudit(row: Record<string, unknown>): HsAuditRecord {
  const crew = String(row.crew_count ?? '')
  const phone = String(row.who_answers_phone ?? '')
  const speed = String(row.pillar_speed ?? '')
  const estimates = String(row.pillar_estimates ?? '')
  const repeat = String(row.pillar_repeat ?? '')
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    completed_at: asString(row.completed_at),
    crm_in_use: asString(row.crm_in_use),
    crew_count: isHsCrewCount(crew) ? crew : null,
    trucks: asInteger(row.trucks),
    who_answers_phone: isHsPhoneCoverage(phone) ? phone : null,
    after_hours_handling: asString(row.after_hours_handling),
    current_ad_spend: asNumber(row.current_ad_spend),
    current_ad_channels: asString(row.current_ad_channels),
    missed_calls_weekly: asInteger(row.missed_calls_weekly),
    avg_response_time: asString(row.avg_response_time),
    existing_followup: asString(row.existing_followup),
    pillar_speed: isHsPillarScore(speed) ? speed : null,
    pillar_speed_note: asString(row.pillar_speed_note),
    pillar_estimates: isHsPillarScore(estimates) ? estimates : null,
    pillar_estimates_note: asString(row.pillar_estimates_note),
    pillar_repeat: isHsPillarScore(repeat) ? repeat : null,
    pillar_repeat_note: asString(row.pillar_repeat_note),
    past_customer_count: asInteger(row.past_customer_count),
    avg_job_value: asNumber(row.avg_job_value),
    unsold_estimates_value: asNumber(row.unsold_estimates_value),
    monthly_lead_volume: asInteger(row.monthly_lead_volume),
    monthly_jobs_booked: asInteger(row.monthly_jobs_booked),
    close_rate: asNumber(row.close_rate),
  }
}

function asDebrief(row: Record<string, unknown>): HsDebriefRecord {
  const outcome = String(row.outcome ?? '')
  const season = String(row.season_timing ?? '')
  const timeline = String(row.timeline ?? '')
  const objections = Array.isArray(row.objections_raised)
    ? row.objections_raised.filter((item): item is string => typeof item === 'string')
    : []
  const fit = asInteger(row.fit_rating)
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    outcome: isHsDebriefOutcome(outcome) ? outcome : null,
    biggest_leak: asString(row.biggest_leak),
    their_words: asString(row.their_words),
    objections_raised: objections,
    objection_notes: asString(row.objection_notes),
    decision_makers: asString(row.decision_makers),
    season_timing: isHsSeasonTiming(season) ? season : null,
    timeline: isHsDebriefTimeline(timeline) ? timeline : null,
    proposed_price: asNumber(row.proposed_price),
    next_step: asString(row.next_step),
    next_step_due: asString(row.next_step_due),
    fit_rating: fit != null && fit >= 1 && fit <= 5 ? fit : null,
    would_i_take_them: typeof row.would_i_take_them === 'boolean' ? row.would_i_take_them : null,
    notes: asString(row.notes),
  }
}

function asRequirements(row: Record<string, unknown>): HsRequirementsRecord {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    sent_at: asString(row.sent_at),
    due_at: asString(row.due_at),
    items: mergeHsRequirementItems(row.items),
    crm_export_owner_name: asString(row.crm_export_owner_name),
    crm_export_owner_email: asString(row.crm_export_owner_email),
    crm_export_owner_phone: asString(row.crm_export_owner_phone),
    dispatch_owner_name: asString(row.dispatch_owner_name),
    decision_maker_name: asString(row.decision_maker_name),
  }
}

export async function listHsCompanies(): Promise<HsCompanyListRow[]> {
  const session = await requireAdmin()
  const supabase = await workspaceClient()
  if (!session || !supabase) return []

  const { data, error } = await supabase.from('hs_companies').select('*').order('created_at', { ascending: false })
  if (error) throw error

  const companies = ((data as Record<string, unknown>[] | null) ?? []).map(asCompany)
  if (companies.length === 0) return []

  const { data: auditRows, error: auditError } = await supabase
    .from('hs_audits')
    .select('*')
    .in(
      'company_id',
      companies.map((row) => row.id),
    )
  if (auditError) throw auditError

  const audits = new Map(
    ((auditRows as Record<string, unknown>[] | null) ?? []).map((row) => {
      const audit = asAudit(row)
      return [audit.company_id, audit] as const
    }),
  )

  return companies.map((company) => {
    const audit = audits.get(company.id)
    return {
      ...company,
      idle_revenue: audit
        ? computeIdleRevenue(audit.past_customer_count, audit.avg_job_value, audit.unsold_estimates_value)
        : null,
    }
  })
}

export async function getHsCompanyBundle(id: string): Promise<{
  company: HsCompanyRecord
  audit: HsAuditRecord | null
  debrief: HsDebriefRecord | null
  requirements: HsRequirementsRecord | null
} | null> {
  const session = await requireAdmin()
  const supabase = await workspaceClient()
  if (!session || !supabase) return null

  const { data, error } = await supabase.from('hs_companies').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null

  const [{ data: auditRow }, { data: debriefRow }, { data: requirementRow }] = await Promise.all([
    supabase.from('hs_audits').select('*').eq('company_id', id).maybeSingle(),
    supabase.from('hs_debriefs').select('*').eq('company_id', id).maybeSingle(),
    supabase.from('hs_requirements').select('*').eq('company_id', id).maybeSingle(),
  ])

  return {
    company: asCompany(data as Record<string, unknown>),
    audit: auditRow ? asAudit(auditRow as Record<string, unknown>) : null,
    debrief: debriefRow ? asDebrief(debriefRow as Record<string, unknown>) : null,
    requirements: requirementRow ? asRequirements(requirementRow as Record<string, unknown>) : null,
  }
}
