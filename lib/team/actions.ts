'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

/**
 * Staff decisions on the accountability system. Each is one staff_* function,
 * which checks the permission in the staff member's own name (so they work
 * inside View As too), their reach over the operator, and records who, when
 * and why.
 */

export type TeamResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; error: string };

async function call<T>(fn: string, args: Record<string, unknown>, message?: string): Promise<TeamResult<T>> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<T>(supabase, fn, args);
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/vistrial/team', 'layout');
  return { ok: true, message, data: (data ?? undefined) as T | undefined };
}

export async function readTeamAction<T>(fn: string, args: Record<string, unknown> = {}): Promise<TeamResult<T>> {
  // Reads only: the staff_* read functions named here.
  const allowed = ['staff_standard_items', 'staff_shift_reviews', 'staff_feedback_context', 'staff_formal_notices'];
  if (!allowed.includes(fn)) return { ok: false, error: 'Not a team read.' };
  const supabase = await createClient();
  const { data, error } = await controlRpc<T>(supabase, fn, args);
  if (error) return { ok: false, error: readable(error) };
  return { ok: true, data: (data ?? undefined) as T | undefined };
}

export async function decideDisputeAction(id: string, approve: boolean, reason: string) {
  return call('staff_decide_dispute', { p_dispute_id: id, p_approve: approve, p_reason: reason }, approve ? 'Approved. The item is left out.' : 'Declined.');
}

export async function resolveBlockerAction(id: string, resolution: string) {
  return call('staff_resolve_blocker', { p_blocker_id: id, p_resolution: resolution }, 'Resolved.');
}

export async function postFeedbackAction(input: { operatorId: string; weekStart: string; keepDoing: string; improve: string; focus: string }) {
  return call(
    'staff_post_feedback',
    {
      p_operator_id: input.operatorId,
      p_week_start: input.weekStart,
      p_keep_doing: input.keepDoing,
      p_improve: input.improve,
      p_focus: input.focus,
    },
    'Posted. The focus shows on their My Day all week.',
  );
}

export async function addExclusionAction(input: { placementId: string; startsAt: string; endsAt: string; kind: string; reason: string }) {
  return call(
    'staff_add_exclusion',
    { p_placement_id: input.placementId, p_starts: input.startsAt, p_ends: input.endsAt, p_kind: input.kind, p_reason: input.reason },
    'Marked. Items in that window are left out for every VA on the placement.',
  );
}

export async function recordFindingAction(input: { operatorId: string; placementId: string; date: string; note: string }) {
  return call(
    'staff_record_finding',
    { p_operator_id: input.operatorId, p_placement_id: input.placementId, p_occurred_on: input.date, p_note: input.note },
    'Recorded. The VA is told and can dispute it.',
  );
}

export async function setProductiveTimeAction(input: { operatorId: string; placementId: string; weekStart: string; minutes: number }) {
  return call(
    'staff_set_productive_time',
    { p_operator_id: input.operatorId, p_placement_id: input.placementId, p_week_start: input.weekStart, p_minutes: input.minutes },
    'Saved.',
  );
}

export async function setProductiveThresholdAction(placementId: string, minutes: number | null) {
  return call('staff_set_productive_threshold', { p_placement_id: placementId, p_minutes: minutes }, 'Saved.');
}

export async function decideTierAction(input: { operatorId: string; toTier: number; approve: boolean; reason: string }) {
  return call(
    'staff_decide_tier',
    { p_operator_id: input.operatorId, p_to_tier: input.toTier, p_approve: input.approve, p_reason: input.reason },
    input.approve ? 'Approved. The VA sees your reason.' : 'Declined. The VA sees your reason.',
  );
}

export async function draftFormalNoticeAction(operatorId: string, templateKey: string) {
  return call<{ id: string; subject: string; body: string }>(
    'staff_draft_formal_notice',
    { p_operator_id: operatorId, p_template_key: templateKey },
    'Drafted. Review and edit it before you send it.',
  );
}

export async function sendFormalNoticeAction(id: string, subject: string, body: string) {
  return call('staff_send_formal_notice', { p_notice_id: id, p_subject: subject, p_body: body }, 'Sent. You are recorded as the approver.');
}

export async function cancelFormalNoticeAction(id: string) {
  return call('staff_cancel_formal_notice', { p_notice_id: id }, 'Cancelled.');
}

export async function saveTeamSettingAction(input: { replyTo: string; fromName: string; inactiveMonths: number | null }) {
  return call(
    'staff_save_team_setting',
    { p_reply_to: input.replyTo || null, p_from_name: input.fromName || null, p_inactive_months: input.inactiveMonths },
    'Saved.',
  );
}

export async function saveCommitmentAction(key: string, targetValue: number | null, targetLabel: string) {
  return call('staff_save_commitment', { p_key: key, p_target_value: targetValue, p_target_label: targetLabel }, 'Saved.');
}

export async function saveTierCriterionAction(input: {
  id: string | null;
  tier: number;
  kind: string;
  threshold: number;
  label: string;
  remove?: boolean;
}) {
  return call(
    'staff_save_tier_criterion',
    {
      p_id: input.id,
      p_tier: input.tier,
      p_kind: input.kind,
      p_threshold: input.threshold,
      p_label: input.label,
      p_delete: Boolean(input.remove),
    },
    input.remove ? 'Removed.' : 'Saved.',
  );
}

export async function saveTemplateAction(key: string, subject: string, body: string) {
  return call('staff_save_template', { p_key: key, p_subject: subject, p_body: body }, 'Saved.');
}

export async function setLdAmountAction(amount: number) {
  return call('staff_set_ld_amount', { p_amount: amount }, 'Saved. New abandonment proposals use this amount.');
}
