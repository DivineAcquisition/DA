'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import type { Result } from './actions';

/**
 * Staff side: View As and the admin panel. Every call is a staff_* or View As
 * function that checks the real signed-in person, never the account on screen,
 * and records them as the one who acted.
 */

async function call<T>(fn: string, args: Record<string, unknown>, message?: string): Promise<Result<T>> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<T>(supabase, fn, args);
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/vistrial', 'layout');
  return { ok: true, message, data: (data ?? undefined) as T | undefined };
}

async function read<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<T>(supabase, fn, args);
  if (error) return { ok: false, error: readable(error) };
  return { ok: true, data: (data ?? undefined) as T | undefined };
}

// View As ---------------------------------------------------------------------------

export async function startViewAsAction(operatorId: string, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const step = await controlRpc<{ ok: boolean; message: string | null }[]>(supabase, 'verify_step_up', {
    p_password: String(formData.get('password') ?? ''),
    p_purpose: 'start an impersonation session',
  });
  if (step.error) return { ok: false, error: readable(step.error) };
  const row = Array.isArray(step.data) ? step.data[0] : null;
  if (!row?.ok) return { ok: false, error: row?.message ?? 'That password does not match.' };

  const { error } = await controlRpc(supabase, 'start_view_as', {
    p_operator_id: operatorId,
    p_reason_kind: String(formData.get('reason_kind') ?? ''),
    p_note: String(formData.get('note') ?? ''),
    p_minutes: 30,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/vistrial', 'layout');
  redirect('/vistrial/operator');
}

export async function extendViewAsAction(reason: string): Promise<Result> {
  return call('extend_view_as', { p_reason: reason }, 'Extended by 30 minutes.');
}

/** Ends the session and returns the viewer to where they started it. */
export async function exitViewAsAction(returnTo: string): Promise<void> {
  const supabase = await createClient();
  await controlRpc(supabase, 'end_impersonation', {});
  revalidatePath('/vistrial', 'layout');
  redirect(returnTo.startsWith('/vistrial/') ? returnTo : '/vistrial');
}

export async function viewAsSessionsAction(filters: {
  operatorId?: string | null;
  actorId?: string | null;
  from?: string | null;
  to?: string | null;
}): Promise<Result<unknown[]>> {
  return read<unknown[]>('view_as_sessions', {
    p_operator_id: filters.operatorId ?? null,
    p_actor_profile_id: filters.actorId ?? null,
    p_from: filters.from || null,
    p_to: filters.to || null,
  });
}

// Admin panel ------------------------------------------------------------------------

export async function staffPanelAction(operatorId: string): Promise<Result<unknown>> {
  return read('staff_panel', { p_operator_id: operatorId });
}

export async function reviewBookingAction(bookingId: string, decision: 'approve' | 'reject', reason: string): Promise<Result> {
  return call(
    'staff_review_booking',
    { p_booking_id: bookingId, p_decision: decision, p_reason: reason || null },
    decision === 'approve' ? 'Approved in your name.' : 'Rejected in your name, with the reason on record.',
  );
}

export async function answerEscalationAction(escalationId: string, answer: string): Promise<Result> {
  return call('staff_answer_escalation', { p_escalation_id: escalationId, p_answer: answer }, 'Answered. The operator is told.');
}

export async function setAttendanceAction(placementId: string, shiftDate: string, status: string, reason: string): Promise<Result> {
  return call(
    'staff_set_attendance',
    { p_placement_id: placementId, p_shift_date: shiftDate, p_status: status, p_reason: reason },
    status === 'abandoned' ? 'Recorded. A $250 proposal now waits for an admin.' : 'Recorded.',
  );
}

export async function assignTaskAction(input: {
  operatorId: string;
  title: string;
  detail: string;
  dueOn: string;
  placementId: string;
}): Promise<Result> {
  return call(
    'staff_assign_task',
    {
      p_operator_id: input.operatorId,
      p_title: input.title,
      p_detail: input.detail,
      p_due_on: input.dueOn || null,
      p_placement_id: input.placementId || null,
    },
    'Task assigned.',
  );
}

export async function assignTrainingAction(input: { operatorId: string; title: string; detail: string; assetId: string }): Promise<Result> {
  return call(
    'staff_assign_training',
    { p_operator_id: input.operatorId, p_title: input.title, p_detail: input.detail, p_asset_id: input.assetId || null },
    'Training assigned.',
  );
}

export async function sendNotificationAction(input: {
  operatorId: string;
  title: string;
  body: string;
  severity: string;
  blocking: boolean;
}): Promise<Result> {
  return call(
    'staff_send_notification',
    {
      p_operator_id: input.operatorId,
      p_title: input.title,
      p_body: input.body,
      p_severity: input.severity,
      p_blocking: input.blocking,
    },
    input.blocking ? 'Blocking notice set. They must confirm it before working.' : 'Sent.',
  );
}

export async function addNoteAction(operatorId: string, body: string): Promise<Result> {
  return call('staff_add_note', { p_operator_id: operatorId, p_body: body }, 'Note added.');
}

export async function decideLdAction(proposalId: string, approve: boolean, reason: string): Promise<Result> {
  return call(
    'staff_decide_ld',
    { p_proposal_id: proposalId, p_approve: approve, p_reason: reason },
    approve ? 'Approved and applied to the open statement.' : 'Dismissed.',
  );
}

export async function answerPayQuestionAction(questionId: string, answer: string): Promise<Result> {
  return call('staff_answer_pay_question', { p_question_id: questionId, p_answer: answer }, 'Answered.');
}

export async function staffCorrectReportAction(input: {
  reportId: string;
  start: string;
  end: string;
  conversations: number;
  appointments: number;
  followUps: number;
  escalations: number;
  reason: string;
}): Promise<Result> {
  return call(
    'staff_correct_report',
    {
      p_report_id: input.reportId,
      p_shift_start_actual: input.start,
      p_shift_end_actual: input.end,
      p_conversations_handled: input.conversations,
      p_appointments_booked: input.appointments,
      p_follow_ups_completed: input.followUps,
      p_escalations_raised: input.escalations,
      p_reason: input.reason,
    },
    'Correction filed in your name.',
  );
}

export async function staffLogBookingAction(input: {
  placementId: string;
  customerName: string;
  phone: string;
  email: string;
  scheduledFor: string;
  reason: string;
}): Promise<Result> {
  return call(
    'staff_log_booking',
    {
      p_placement_id: input.placementId,
      p_customer_name: input.customerName,
      p_customer_phone: input.phone,
      p_customer_email: input.email,
      p_scheduled_for: input.scheduledFor,
      p_reason: input.reason,
    },
    'Added for review.',
  );
}

// Playbooks ----------------------------------------------------------------------------

export async function staffPlaybookAction(placementId: string): Promise<Result<unknown>> {
  return read('staff_playbook', { p_placement_id: placementId });
}

export async function savePlaybookAction(input: {
  placementId: string;
  scope: 'client' | 'placement';
  fields: Record<string, unknown>;
  assetIds: string[];
  changeNote: string;
  major: boolean;
}): Promise<Result<{ version: number }>> {
  return call(
    'staff_save_playbook',
    {
      p_placement_id: input.placementId,
      p_scope: input.scope,
      p_fields: input.fields,
      p_asset_ids: input.assetIds,
      p_change_note: input.changeNote,
      p_major: input.major,
    },
    input.major ? 'Saved. Every VA on it must read and confirm it.' : 'Saved. Every VA on it has been told.',
  );
}

// Staff inbox -----------------------------------------------------------------------------

export async function markStaffNotificationsReadAction(ids: string[] | null): Promise<void> {
  await call('staff_mark_notifications_read', { p_ids: ids });
}
