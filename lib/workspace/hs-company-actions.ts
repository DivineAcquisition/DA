'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin, workspaceClient, type UntypedClient } from './db'
import type { ActionResult } from './types'
import {
  HS_OBJECTION_CHIPS,
  HS_REQUIREMENT_ITEMS,
  blankToNull,
  hsStageAfterDebriefOutcome,
  hsStageWouldAdvance,
  isHsCompanyStage,
  isHsCrewCount,
  isHsDebriefOutcome,
  isHsDebriefTimeline,
  isHsPhoneCoverage,
  isHsPillarScore,
  isHsSeasonTiming,
  isHsTrade,
  type HsAuditDraft,
  type HsCompanyStage,
  type HsDebriefDraft,
  type HsRequirementDraft,
  type HsTrade,
} from './hs-companies'

async function maybeAdvanceHsCompanyStage(
  supabase: UntypedClient,
  companyId: string,
  next: HsCompanyStage,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('hs_companies')
    .select('stage')
    .eq('id', companyId)
    .maybeSingle()
  if (error) return error.message
  const current = data ? String(data.stage) : ''
  if (!isHsCompanyStage(current)) return 'Company not found.'
  if (!hsStageWouldAdvance(current, next)) return null
  const { error: updateError } = await supabase
    .from('hs_companies')
    .update({ stage: next })
    .eq('id', companyId)
  return updateError?.message ?? null
}

function revalidateHsCompany(id?: string) {
  revalidatePath('/workspace/hs/companies')
  revalidatePath('/hs/companies')
  revalidatePath('/workspace/accounts')
  revalidatePath('/accounts')
  if (id) {
    revalidatePath(`/workspace/hs/companies/${id}`)
    revalidatePath(`/hs/companies/${id}`)
    revalidatePath(`/workspace/hs/companies/${id}/audit`)
    revalidatePath(`/workspace/hs/companies/${id}/debrief`)
    revalidatePath(`/workspace/hs/companies/${id}/requirements`)
    revalidatePath(`/hs/companies/${id}/audit`)
    revalidatePath(`/hs/companies/${id}/debrief`)
    revalidatePath(`/hs/companies/${id}/requirements`)
  }
}

function asTrade(value: string): HsTrade | null {
  return isHsTrade(value) ? value : null
}

function nonNeg(n: number | null): number | null {
  if (n == null || Number.isNaN(n)) return null
  return n < 0 ? 0 : n
}

function nonNegInt(n: number | null): number | null {
  const v = nonNeg(n)
  return v == null ? null : Math.trunc(v)
}

async function findCallId(
  supabase: NonNullable<Awaited<ReturnType<typeof workspaceClient>>>,
  company_name: string,
  contact_name: string,
): Promise<string | null> {
  // Gap: new-company dialog has no email, so linking is a case-insensitive exact
  // match on company_name + contact_name only. No call picker in this brief.
  const { data, error } = await supabase
    .from('hs_calls')
    .select('id')
    .ilike('company_name', company_name)
    .ilike('contact_name', contact_name)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data?.id ? String(data.id) : null
}

async function upsertByCompanyId(
  supabase: NonNullable<Awaited<ReturnType<typeof workspaceClient>>>,
  table: 'hs_audits' | 'hs_debriefs' | 'hs_requirements',
  id: string | null,
  companyId: string,
  row: Record<string, unknown>,
): Promise<{ id: string } | { error: string }> {
  if (id) {
    const { error } = await supabase.from(table).update(row).eq('id', id)
    if (error) return { error: error.message }
    return { id }
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ ...row, company_id: companyId })
    .select('id')
    .single()

  if (!error && data?.id) return { id: String(data.id) }

  if (error?.code === '23505') {
    const existing = await supabase.from(table).select('id').eq('company_id', companyId).maybeSingle()
    const existingId = existing.data?.id ? String(existing.data.id) : null
    if (existingId) {
      const { error: updateError } = await supabase.from(table).update(row).eq('id', existingId)
      if (updateError) return { error: updateError.message }
      return { id: existingId }
    }
  }

  return { error: error?.message ?? 'Could not save.' }
}

export async function createHsCompanyAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin()
  const supabase = await workspaceClient()
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' }

  const company_name = String(formData.get('company_name') ?? '').trim()
  const contact_name = String(formData.get('contact_name') ?? '').trim()
  const trade = asTrade(String(formData.get('trade') ?? ''))

  if (!company_name || !contact_name || !trade) {
    return { ok: false, error: 'Company name, contact name, and trade are required.' }
  }

  const call_id = await findCallId(supabase, company_name, contact_name)

  const { data, error } = await supabase
    .from('hs_companies')
    .insert({
      company_name,
      contact_name,
      trade,
      call_id,
    })
    .select('id')
    .single()

  if (error || !data?.id) return { ok: false, error: error?.message ?? 'Could not create the company.' }

  const id = String(data.id)
  revalidateHsCompany(id)
  redirect(`/workspace/hs/companies/${id}/audit`)
}

export async function updateHsCompanyStageAction(id: string, stage: string): Promise<ActionResult> {
  const session = await requireAdmin()
  const supabase = await workspaceClient()
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' }
  if (!isHsCompanyStage(stage)) return { ok: false, error: 'Unknown stage.' }

  const { error } = await supabase.from('hs_companies').update({ stage }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateHsCompany(id)
  return { ok: true, message: 'Stage updated.' }
}

export async function updateHsCompanyTradeAction(id: string, trade: string): Promise<ActionResult> {
  const session = await requireAdmin()
  const supabase = await workspaceClient()
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' }
  const next = asTrade(trade)
  if (!next) return { ok: false, error: 'Unknown niche.' }

  const { error } = await supabase.from('hs_companies').update({ trade: next }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateHsCompany(id)
  return { ok: true, message: 'Niche updated.' }
}

export async function deleteHsCompanyAction(id: string, typedName: string): Promise<ActionResult> {
  const session = await requireAdmin()
  const supabase = await workspaceClient()
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' }

  const { data } = await supabase.from('hs_companies').select('company_name').eq('id', id).maybeSingle()
  if (!data) return { ok: false, error: 'Company not found.' }
  if (String(data.company_name) !== typedName) {
    return { ok: false, error: 'Type the company name to confirm deletion.' }
  }

  const { error } = await supabase.from('hs_companies').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidateHsCompany()
  redirect('/workspace/accounts')
}

function auditRow(draft: HsAuditDraft): Record<string, unknown> {
  return {
    crm_in_use: blankToNull(draft.crm_in_use),
    crew_count: draft.crew_count && isHsCrewCount(draft.crew_count) ? draft.crew_count : null,
    trucks: nonNegInt(draft.trucks),
    who_answers_phone:
      draft.who_answers_phone && isHsPhoneCoverage(draft.who_answers_phone) ? draft.who_answers_phone : null,
    after_hours_handling: blankToNull(draft.after_hours_handling),
    current_ad_spend: nonNeg(draft.current_ad_spend),
    current_ad_channels: blankToNull(draft.current_ad_channels),
    missed_calls_weekly: nonNegInt(draft.missed_calls_weekly),
    avg_response_time: blankToNull(draft.avg_response_time),
    existing_followup: blankToNull(draft.existing_followup),
    pillar_speed: draft.pillar_speed && isHsPillarScore(draft.pillar_speed) ? draft.pillar_speed : null,
    pillar_speed_note: blankToNull(draft.pillar_speed_note),
    pillar_estimates:
      draft.pillar_estimates && isHsPillarScore(draft.pillar_estimates) ? draft.pillar_estimates : null,
    pillar_estimates_note: blankToNull(draft.pillar_estimates_note),
    pillar_repeat: draft.pillar_repeat && isHsPillarScore(draft.pillar_repeat) ? draft.pillar_repeat : null,
    pillar_repeat_note: blankToNull(draft.pillar_repeat_note),
    past_customer_count: nonNegInt(draft.past_customer_count),
    avg_job_value: nonNeg(draft.avg_job_value),
    unsold_estimates_value: nonNeg(draft.unsold_estimates_value),
    monthly_lead_volume: nonNegInt(draft.monthly_lead_volume),
    monthly_jobs_booked: nonNegInt(draft.monthly_jobs_booked),
    close_rate:
      draft.close_rate == null ? null : Math.min(100, Math.max(0, draft.close_rate)),
  }
}

export async function saveHsAuditAction(
  companyId: string,
  auditId: string | null,
  draft: HsAuditDraft,
): Promise<ActionResult> {
  const session = await requireAdmin()
  const supabase = await workspaceClient()
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' }

  const result = await upsertByCompanyId(supabase, 'hs_audits', auditId, companyId, auditRow(draft))
  if ('error' in result) return { ok: false, error: result.error }
  revalidateHsCompany(companyId)
  return { ok: true, message: 'Audit saved.', data: { id: result.id } }
}

export async function markHsAuditCompleteAction(
  companyId: string,
  auditId: string | null,
  draft: HsAuditDraft,
): Promise<ActionResult> {
  const session = await requireAdmin()
  const supabase = await workspaceClient()
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' }

  const saved = await upsertByCompanyId(supabase, 'hs_audits', auditId, companyId, auditRow(draft))
  if ('error' in saved) return { ok: false, error: saved.error }

  const { error: auditError } = await supabase
    .from('hs_audits')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', saved.id)
  if (auditError) return { ok: false, error: auditError.message }

  const companyError = await maybeAdvanceHsCompanyStage(supabase, companyId, 'audited')
  if (companyError) return { ok: false, error: companyError }

  revalidateHsCompany(companyId)
  return { ok: true, message: 'Audit marked complete.', data: { id: saved.id } }
}

function debriefRow(draft: HsDebriefDraft): Record<string, unknown> {
  const allowed = new Set<string>(HS_OBJECTION_CHIPS)
  const fit =
    draft.fit_rating != null && draft.fit_rating >= 1 && draft.fit_rating <= 5
      ? Math.trunc(draft.fit_rating)
      : null
  return {
    outcome: draft.outcome && isHsDebriefOutcome(draft.outcome) ? draft.outcome : null,
    biggest_leak: blankToNull(draft.biggest_leak),
    their_words: blankToNull(draft.their_words),
    objections_raised: draft.objections_raised.filter((item) => allowed.has(item)),
    objection_notes: blankToNull(draft.objection_notes),
    decision_makers: blankToNull(draft.decision_makers),
    season_timing: draft.season_timing && isHsSeasonTiming(draft.season_timing) ? draft.season_timing : null,
    timeline: draft.timeline && isHsDebriefTimeline(draft.timeline) ? draft.timeline : null,
    proposed_price: nonNeg(draft.proposed_price),
    next_step: blankToNull(draft.next_step),
    next_step_due: blankToNull(draft.next_step_due),
    fit_rating: fit,
    would_i_take_them: typeof draft.would_i_take_them === 'boolean' ? draft.would_i_take_them : null,
    notes: blankToNull(draft.notes),
  }
}

export async function saveHsDebriefAction(
  companyId: string,
  debriefId: string | null,
  draft: HsDebriefDraft,
  applyOutcomeStage = false,
): Promise<ActionResult> {
  const session = await requireAdmin()
  const supabase = await workspaceClient()
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' }

  const saved = await upsertByCompanyId(supabase, 'hs_debriefs', debriefId, companyId, debriefRow(draft))
  if ('error' in saved) return { ok: false, error: saved.error }

  if (applyOutcomeStage && draft.outcome && isHsDebriefOutcome(draft.outcome)) {
    const stage = hsStageAfterDebriefOutcome(draft.outcome)
    if (stage) {
      const error = await maybeAdvanceHsCompanyStage(supabase, companyId, stage)
      if (error) return { ok: false, error }
    }
  }

  revalidateHsCompany(companyId)
  return { ok: true, message: 'Debrief saved.', data: { id: saved.id } }
}

function requirementRow(draft: HsRequirementDraft): Record<string, unknown> {
  const items = draft.items.length > 0 ? draft.items : HS_REQUIREMENT_ITEMS
  return {
    items,
    crm_export_owner_name: blankToNull(draft.crm_export_owner_name),
    crm_export_owner_email: blankToNull(draft.crm_export_owner_email),
    crm_export_owner_phone: blankToNull(draft.crm_export_owner_phone),
    dispatch_owner_name: blankToNull(draft.dispatch_owner_name),
    decision_maker_name: blankToNull(draft.decision_maker_name),
  }
}

export async function saveHsRequirementAction(
  companyId: string,
  requirementId: string | null,
  draft: HsRequirementDraft,
): Promise<ActionResult> {
  const session = await requireAdmin()
  const supabase = await workspaceClient()
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' }

  const saved = await upsertByCompanyId(
    supabase,
    'hs_requirements',
    requirementId,
    companyId,
    requirementRow(draft),
  )
  if ('error' in saved) return { ok: false, error: saved.error }
  revalidateHsCompany(companyId)
  return { ok: true, message: 'Requirements saved.', data: { id: saved.id } }
}

export async function markHsRequirementSentAction(
  companyId: string,
  requirementId: string | null,
  draft: HsRequirementDraft,
): Promise<ActionResult> {
  const session = await requireAdmin()
  const supabase = await workspaceClient()
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' }

  const saved = await upsertByCompanyId(
    supabase,
    'hs_requirements',
    requirementId,
    companyId,
    requirementRow(draft),
  )
  if ('error' in saved) return { ok: false, error: saved.error }

  const sentAt = new Date()
  const dueAt = new Date(sentAt.getTime() + 72 * 60 * 60 * 1000)
  const { error } = await supabase
    .from('hs_requirements')
    .update({
      sent_at: sentAt.toISOString(),
      due_at: dueAt.toISOString(),
    })
    .eq('id', saved.id)
  if (error) return { ok: false, error: error.message }

  revalidateHsCompany(companyId)
  return {
    ok: true,
    message: 'Marked as sent.',
    data: { id: saved.id, sent_at: sentAt.toISOString(), due_at: dueAt.toISOString() },
  }
}
