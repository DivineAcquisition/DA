'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, workspaceClient, type UntypedClient } from './db';
import { PRACTICE_TYPES, type PracticeType } from './calls';
import type { ActionResult } from './types';
import {
  blankToNull,
  isDebriefOutcome,
  isDebriefTimeline,
  isFrontDeskSize,
  isPillarScore,
  isPracticeStage,
  practiceStageAfterDebriefOutcome,
  practiceStageWouldAdvance,
  OBJECTION_CHIPS,
  REQUIREMENT_ITEMS,
  type AuditDraft,
  type DebriefDraft,
  type PracticeStage,
  type RequirementDraft,
} from './practices';

async function maybeAdvancePracticeStage(
  supabase: UntypedClient,
  practiceId: string,
  next: PracticeStage,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('practices')
    .select('stage')
    .eq('id', practiceId)
    .maybeSingle();
  if (error) return error.message;
  const current = data ? String(data.stage) : '';
  if (!isPracticeStage(current)) return 'Practice not found.';
  if (!practiceStageWouldAdvance(current, next)) return null;
  const { error: updateError } = await supabase
    .from('practices')
    .update({ stage: next })
    .eq('id', practiceId);
  return updateError?.message ?? null;
}

function revalidatePractice(id?: string) {
  revalidatePath('/workspace/practices');
  revalidatePath('/practices');
  revalidatePath('/workspace/accounts');
  revalidatePath('/accounts');
  if (id) {
    revalidatePath(`/workspace/practices/${id}`);
    revalidatePath(`/practices/${id}`);
    revalidatePath(`/workspace/practices/${id}/audit`);
    revalidatePath(`/workspace/practices/${id}/debrief`);
    revalidatePath(`/workspace/practices/${id}/requirements`);
    revalidatePath(`/practices/${id}/audit`);
    revalidatePath(`/practices/${id}/debrief`);
    revalidatePath(`/practices/${id}/requirements`);
  }
}

function asPracticeType(value: string): PracticeType | null {
  return (PRACTICE_TYPES as readonly string[]).includes(value) ? (value as PracticeType) : null;
}

function nonNeg(n: number | null): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return n < 0 ? 0 : n;
}

function nonNegInt(n: number | null): number | null {
  const v = nonNeg(n);
  return v == null ? null : Math.trunc(v);
}

async function findCallId(
  supabase: NonNullable<Awaited<ReturnType<typeof workspaceClient>>>,
  practice_name: string,
  contact_name: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('calls')
    .select('id')
    .ilike('practice_name', practice_name)
    .ilike('contact_name', contact_name)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.id ? String(data.id) : null;
}

async function upsertByPracticeId(
  supabase: NonNullable<Awaited<ReturnType<typeof workspaceClient>>>,
  table: 'audits' | 'debriefs' | 'requirements',
  id: string | null,
  practiceId: string,
  row: Record<string, unknown>,
): Promise<{ id: string } | { error: string }> {
  if (id) {
    const { error } = await supabase.from(table).update(row).eq('id', id);
    if (error) return { error: error.message };
    return { id };
  }

  const { data, error } = await supabase
    .from(table)
    .insert({ ...row, practice_id: practiceId })
    .select('id')
    .single();

  if (!error && data?.id) return { id: String(data.id) };

  if (error?.code === '23505') {
    const existing = await supabase.from(table).select('id').eq('practice_id', practiceId).maybeSingle();
    const existingId = existing.data?.id ? String(existing.data.id) : null;
    if (existingId) {
      const { error: updateError } = await supabase.from(table).update(row).eq('id', existingId);
      if (updateError) return { error: updateError.message };
      return { id: existingId };
    }
  }

  return { error: error?.message ?? 'Could not save.' };
}

export async function createPracticeAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const practice_name = String(formData.get('practice_name') ?? '').trim();
  const contact_name = String(formData.get('contact_name') ?? '').trim();
  const practice_type = asPracticeType(String(formData.get('practice_type') ?? ''));

  if (!practice_name || !contact_name || !practice_type) {
    return { ok: false, error: 'Practice name, contact name, and practice type are required.' };
  }

  const call_id = await findCallId(supabase, practice_name, contact_name);

  const { data, error } = await supabase
    .from('practices')
    .insert({
      practice_name,
      contact_name,
      practice_type,
      call_id,
    })
    .select('id')
    .single();

  if (error || !data?.id) return { ok: false, error: error?.message ?? 'Could not create the practice.' };

  const id = String(data.id);
  revalidatePractice(id);
  redirect(`/workspace/practices/${id}/audit`);
}

export async function updatePracticeStageAction(id: string, stage: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };
  if (!isPracticeStage(stage)) return { ok: false, error: 'Unknown stage.' };

  const { error } = await supabase.from('practices').update({ stage }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePractice(id);
  return { ok: true, message: 'Stage updated.' };
}

export async function updatePracticeTypeAction(id: string, practiceType: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };
  const next = asPracticeType(practiceType);
  if (!next) return { ok: false, error: 'Unknown niche.' };

  const { error } = await supabase.from('practices').update({ practice_type: next }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePractice(id);
  return { ok: true, message: 'Niche updated.' };
}

export async function deletePracticeAction(id: string, typedName: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const { data } = await supabase.from('practices').select('practice_name').eq('id', id).maybeSingle();
  if (!data) return { ok: false, error: 'Practice not found.' };
  if (String(data.practice_name) !== typedName) {
    return { ok: false, error: 'Type the practice name to confirm deletion.' };
  }

  const { error } = await supabase.from('practices').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePractice();
  redirect('/workspace/accounts');
}

function auditRow(draft: AuditDraft): Record<string, unknown> {
  return {
    pms_in_use: blankToNull(draft.pms_in_use),
    front_desk_size: draft.front_desk_size && isFrontDeskSize(draft.front_desk_size) ? draft.front_desk_size : null,
    operatories: nonNegInt(draft.operatories),
    current_ad_spend: nonNeg(draft.current_ad_spend),
    current_ad_channels: blankToNull(draft.current_ad_channels),
    phone_owner: blankToNull(draft.phone_owner),
    missed_calls_weekly: nonNegInt(draft.missed_calls_weekly),
    existing_followup: blankToNull(draft.existing_followup),
    pillar_acquisition: draft.pillar_acquisition && isPillarScore(draft.pillar_acquisition) ? draft.pillar_acquisition : null,
    pillar_acquisition_note: blankToNull(draft.pillar_acquisition_note),
    pillar_reactivation:
      draft.pillar_reactivation && isPillarScore(draft.pillar_reactivation) ? draft.pillar_reactivation : null,
    pillar_reactivation_note: blankToNull(draft.pillar_reactivation_note),
    pillar_showup: draft.pillar_showup && isPillarScore(draft.pillar_showup) ? draft.pillar_showup : null,
    pillar_showup_note: blankToNull(draft.pillar_showup_note),
    recall_list_size: nonNegInt(draft.recall_list_size),
    avg_hygiene_value: nonNeg(draft.avg_hygiene_value),
    unscheduled_treatment_value: nonNeg(draft.unscheduled_treatment_value),
    avg_new_patient_value: nonNeg(draft.avg_new_patient_value),
    current_no_show_rate:
      draft.current_no_show_rate == null
        ? null
        : Math.min(100, Math.max(0, draft.current_no_show_rate)),
    monthly_new_patients: nonNegInt(draft.monthly_new_patients),
  };
}

export async function saveAuditAction(
  practiceId: string,
  auditId: string | null,
  draft: AuditDraft,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const result = await upsertByPracticeId(supabase, 'audits', auditId, practiceId, auditRow(draft));
  if ('error' in result) return { ok: false, error: result.error };
  revalidatePractice(practiceId);
  return { ok: true, message: 'Audit saved.', data: { id: result.id } };
}

export async function markAuditCompleteAction(
  practiceId: string,
  auditId: string | null,
  draft: AuditDraft,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const saved = await upsertByPracticeId(supabase, 'audits', auditId, practiceId, auditRow(draft));
  if ('error' in saved) return { ok: false, error: saved.error };

  const { error: auditError } = await supabase
    .from('audits')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', saved.id);
  if (auditError) return { ok: false, error: auditError.message };

  const practiceError = await maybeAdvancePracticeStage(supabase, practiceId, 'audited');
  if (practiceError) return { ok: false, error: practiceError };

  revalidatePractice(practiceId);
  return { ok: true, message: 'Audit marked complete.', data: { id: saved.id } };
}

function debriefRow(draft: DebriefDraft): Record<string, unknown> {
  const allowed = new Set<string>(OBJECTION_CHIPS);
  const fit =
    draft.fit_rating != null && draft.fit_rating >= 1 && draft.fit_rating <= 5 ? Math.trunc(draft.fit_rating) : null;
  return {
    outcome: draft.outcome && isDebriefOutcome(draft.outcome) ? draft.outcome : null,
    biggest_leak: blankToNull(draft.biggest_leak),
    their_words: blankToNull(draft.their_words),
    objections_raised: draft.objections_raised.filter((item) => allowed.has(item)),
    objection_notes: blankToNull(draft.objection_notes),
    decision_makers: blankToNull(draft.decision_makers),
    timeline: draft.timeline && isDebriefTimeline(draft.timeline) ? draft.timeline : null,
    proposed_price: nonNeg(draft.proposed_price),
    next_step: blankToNull(draft.next_step),
    next_step_due: blankToNull(draft.next_step_due),
    fit_rating: fit,
    would_i_take_them: typeof draft.would_i_take_them === 'boolean' ? draft.would_i_take_them : null,
    notes: blankToNull(draft.notes),
  };
}

export async function saveDebriefAction(
  practiceId: string,
  debriefId: string | null,
  draft: DebriefDraft,
  applyOutcomeStage = false,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const saved = await upsertByPracticeId(supabase, 'debriefs', debriefId, practiceId, debriefRow(draft));
  if ('error' in saved) return { ok: false, error: saved.error };

  if (applyOutcomeStage && draft.outcome && isDebriefOutcome(draft.outcome)) {
    const stage = practiceStageAfterDebriefOutcome(draft.outcome);
    if (stage) {
      const error = await maybeAdvancePracticeStage(supabase, practiceId, stage);
      if (error) return { ok: false, error };
    }
  }

  revalidatePractice(practiceId);
  return { ok: true, message: 'Debrief saved.', data: { id: saved.id } };
}

function requirementRow(draft: RequirementDraft): Record<string, unknown> {
  const items = draft.items.length > 0 ? draft.items : REQUIREMENT_ITEMS;
  return {
    items,
    pms_export_owner_name: blankToNull(draft.pms_export_owner_name),
    pms_export_owner_email: blankToNull(draft.pms_export_owner_email),
    pms_export_owner_phone: blankToNull(draft.pms_export_owner_phone),
    front_desk_owner_name: blankToNull(draft.front_desk_owner_name),
    decision_maker_name: blankToNull(draft.decision_maker_name),
  };
}

export async function saveRequirementAction(
  practiceId: string,
  requirementId: string | null,
  draft: RequirementDraft,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const saved = await upsertByPracticeId(supabase, 'requirements', requirementId, practiceId, requirementRow(draft));
  if ('error' in saved) return { ok: false, error: saved.error };
  revalidatePractice(practiceId);
  return { ok: true, message: 'Requirements saved.', data: { id: saved.id } };
}

export async function markRequirementSentAction(
  practiceId: string,
  requirementId: string | null,
  draft: RequirementDraft,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const saved = await upsertByPracticeId(supabase, 'requirements', requirementId, practiceId, requirementRow(draft));
  if ('error' in saved) return { ok: false, error: saved.error };

  const sentAt = new Date();
  const dueAt = new Date(sentAt.getTime() + 72 * 60 * 60 * 1000);
  const { error } = await supabase
    .from('requirements')
    .update({
      sent_at: sentAt.toISOString(),
      due_at: dueAt.toISOString(),
    })
    .eq('id', saved.id);
  if (error) return { ok: false, error: error.message };

  revalidatePractice(practiceId);
  return {
    ok: true,
    message: 'Marked as sent.',
    data: { id: saved.id, sent_at: sentAt.toISOString(), due_at: dueAt.toISOString() },
  };
}
