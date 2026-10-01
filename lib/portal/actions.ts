'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient, getSessionContext } from '@/lib/supabase/server';
import { PLACEMENT_COOKIE } from './load';
import type { Prefill, StandardItems } from './types';

/**
 * The VA's own actions. Each is one portal_* function; the database checks the
 * permission (blocked during View As), the placement and every field. Nothing
 * here decides who may do what.
 */

export type Result<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; error: string };

async function call<T>(fn: string, args: Record<string, unknown>, message?: string): Promise<Result<T>> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<T>(supabase, fn, args);
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/vistrial/operator', 'layout');
  return { ok: true, message, data: (data ?? undefined) as T | undefined };
}

export async function selectPlacementAction(placementId: string): Promise<void> {
  const jar = await cookies();
  // Path '/': on team.* the browser sees /operator, not /vistrial/operator.
  jar.set(PLACEMENT_COOKIE, placementId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 90 });
  revalidatePath('/vistrial/operator', 'layout');
}

// Bookings -------------------------------------------------------------------

type LogResult = { ok: boolean; duplicate?: { id: string; customer: string; scheduled_for: string; state: string; source: string } };

export async function logBookingAction(input: {
  placementId: string;
  customerName: string;
  phone: string;
  email: string;
  scheduledFor: string | null;
  liveTransfer: boolean;
  note: string;
  confirmDistinctFrom?: string | null;
  distinctReason?: string | null;
}): Promise<Result<LogResult>> {
  return call<LogResult>(
    'portal_log_booking',
    {
      p_placement_id: input.placementId,
      p_customer_name: input.customerName,
      p_customer_phone: input.phone,
      p_customer_email: input.email,
      p_scheduled_for: input.liveTransfer ? null : input.scheduledFor,
      p_live_transfer: input.liveTransfer,
      p_note: input.note,
      p_confirm_distinct_from: input.confirmDistinctFrom ?? null,
      p_distinct_reason: input.distinctReason ?? null,
    },
    'Logged. It is waiting for DA to verify it.',
  );
}

// Escalations ------------------------------------------------------------------

export async function raiseEscalationAction(input: {
  placementId: string;
  category: string;
  context: string;
  needed: string;
}): Promise<Result<{ id: string; response_due_at: string; holding_line: string }>> {
  return call(
    'portal_raise_escalation',
    {
      p_placement_id: input.placementId,
      p_category: input.category,
      p_customer_context: input.context,
      p_needed: input.needed,
    },
    'Sent to DA.',
  );
}

export async function closeEscalationAction(id: string): Promise<Result> {
  return call('portal_close_escalation', { p_escalation_id: id }, 'Closed.');
}

export async function markEscalationReadAction(id: string): Promise<void> {
  await call('portal_mark_escalation_read', { p_escalation_id: id });
}

// Shift reports -----------------------------------------------------------------

export async function prefillAction(placementId: string, shiftDate: string): Promise<Result<Prefill>> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<Prefill>(supabase, 'portal_shift_prefill', {
    p_placement_id: placementId,
    p_shift_date: shiftDate,
  });
  if (error || !data) return { ok: false, error: readable(error) };
  return { ok: true, data };
}

export type ReportInput = {
  start: string;
  end: string;
  conversations: number;
  appointments: number;
  followUps: number;
  escalations: number;
  blockers: string;
  notes: string;
  configured: Record<string, unknown>;
  varianceExplanation: string;
};

export async function submitReportAction(placementId: string, shiftDate: string, input: ReportInput): Promise<Result> {
  return call(
    'portal_submit_report',
    {
      p_placement_id: placementId,
      p_shift_date: shiftDate,
      p_shift_start_actual: input.start,
      p_shift_end_actual: input.end,
      p_conversations_handled: input.conversations,
      p_appointments_booked: input.appointments,
      p_follow_ups_completed: input.followUps,
      p_escalations_raised: input.escalations,
      p_blockers: input.blockers,
      p_notes: input.notes,
      p_configured: input.configured,
      p_variance_explanation: input.varianceExplanation || null,
    },
    'Report filed.',
  );
}

export async function correctReportAction(reportId: string, input: ReportInput, reason: string): Promise<Result> {
  return call(
    'portal_correct_report',
    {
      p_report_id: reportId,
      p_shift_start_actual: input.start,
      p_shift_end_actual: input.end,
      p_conversations_handled: input.conversations,
      p_appointments_booked: input.appointments,
      p_follow_ups_completed: input.followUps,
      p_escalations_raised: input.escalations,
      p_blockers: input.blockers,
      p_notes: input.notes,
      p_configured: input.configured,
      p_reason: reason,
      p_variance_explanation: input.varianceExplanation || null,
    },
    'Correction filed. The original stays on record.',
  );
}

export async function reportAbsenceAction(placementId: string, shiftDate: string, reason: string): Promise<Result<{ late_notice: boolean }>> {
  return call('portal_report_absence', { p_placement_id: placementId, p_shift_date: shiftDate, p_reason: reason }, 'DA has been told.');
}

// Notices, tasks, notifications ------------------------------------------------------

export async function acknowledgeNoticeAction(id: string): Promise<Result> {
  return call('portal_acknowledge_notice', { p_notice_id: id }, 'Confirmed.');
}

export async function completeTaskAction(id: string): Promise<Result> {
  return call('portal_complete_task', { p_task_id: id }, 'Done.');
}

export async function completeTrainingAction(id: string): Promise<Result> {
  return call('portal_complete_training', { p_training_id: id }, 'Done.');
}

export async function markNotificationReadAction(id: string): Promise<void> {
  await call('portal_mark_notification_read', { p_notification_id: id });
}

// Pay ------------------------------------------------------------------------------

export async function askPayQuestionAction(statementId: string, body: string): Promise<Result> {
  return call('portal_ask_pay_question', { p_statement_id: statementId, p_body: body }, 'Sent to DA. You will see the answer here.');
}

export async function markPayAnswerReadAction(id: string): Promise<void> {
  await call('portal_mark_pay_answer_read', { p_question_id: id });
}

// Profile ------------------------------------------------------------------------------

export async function updateProfileAction(input: {
  name: string;
  phone: string;
  handle: string;
  timeZone: string;
  channel: string;
}): Promise<Result> {
  return call(
    'portal_update_profile',
    {
      p_name: input.name,
      p_phone: input.phone,
      p_handle: input.handle,
      p_time_zone: input.timeZone,
      p_preferred_channel: input.channel,
    },
    'Saved.',
  );
}

/** A fresh password confirmation, then the change. Both run in the database. */
export async function changePayoutAction(input: { method: string; reference: string; password: string }): Promise<Result> {
  const supabase = await createClient();
  const step = await controlRpc<{ ok: boolean; message: string | null }[]>(supabase, 'verify_step_up', {
    p_password: input.password,
    p_purpose: 'change your payout method',
  });
  if (step.error) return { ok: false, error: readable(step.error) };
  const row = Array.isArray(step.data) ? step.data[0] : null;
  if (!row?.ok) return { ok: false, error: row?.message ?? 'That password does not match.' };
  return call(
    'portal_change_payout',
    { p_method: input.method, p_reference: input.reference },
    'Payout method changed. DA has been told, and so have you.',
  );
}

export async function submitTaxDocumentAction(link: string): Promise<Result> {
  return call('portal_submit_tax_document', { p_reference: link }, 'Submitted. DA will review it.');
}

export async function removeDeviceAction(fingerprint: string): Promise<Result> {
  return call('portal_remove_device', { p_fingerprint: fingerprint }, 'Device removed.');
}

/**
 * Two-factor setup runs against the signed-in session. During View As that
 * session is the viewer's own, so it is refused outright: nobody sets up a
 * second factor for someone else, or on themselves by accident.
 */
async function refuseDuringViewAs(): Promise<string | null> {
  const session = await getSessionContext();
  if (!session) return 'Sign in first.';
  if (session.impersonation) return 'Only the account holder can set up two-factor sign-in.';
  return null;
}

export async function startMfaEnrollAction(): Promise<Result<{ factorId: string; qr: string; secret: string }>> {
  const refused = await refuseDuringViewAs();
  if (refused) return { ok: false, error: refused };
  const supabase = await createClient();

  // A factor left unverified from an earlier attempt blocks a new one.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Portal ${Date.now()}` });
  if (error || !data) return { ok: false, error: error?.message ?? 'Two-factor setup could not start.' };
  return { ok: true, data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } };
}

export async function verifyMfaEnrollAction(factorId: string, code: string): Promise<Result> {
  const refused = await refuseDuringViewAs();
  if (refused) return { ok: false, error: refused };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s+/g, '') });
  if (error) return { ok: false, error: 'That code did not match. Use the newest code from your app.' };
  revalidatePath('/vistrial/operator', 'layout');
  return { ok: true, message: 'Two-factor sign-in is on.' };
}

// Prompt 8: shift reviews, standards, growth, availability ---------------------

export type ReviewEntry = {
  conversations_handled?: number | null;
  appointments_booked?: number | null;
  follow_ups_completed?: number | null;
  escalations_raised?: number | null;
  shift_start_actual?: string | null;
  shift_end_actual?: string | null;
};

/** Confirm the draft, or correct it with a reason. Both values are kept. */
export async function confirmShiftAction(input: {
  placementId: string;
  shiftDate: string;
  entered: ReviewEntry;
  reason: string;
  blockers: { control: string; note: string }[];
  wentWell: string;
  differently: string;
  inWay: string;
}): Promise<Result<{ id: string; corrected: boolean }>> {
  const entered = Object.fromEntries(Object.entries(input.entered).filter(([, value]) => value !== null && value !== undefined && value !== ''));
  return call(
    'portal_confirm_shift',
    {
      p_placement_id: input.placementId,
      p_shift_date: input.shiftDate,
      p_entered: entered,
      p_variance_explanation: input.reason || null,
      p_blockers: input.blockers.filter((b) => b.note.trim()),
      p_went_well: input.wentWell || null,
      p_differently: input.differently || null,
      p_in_way: input.inWay || null,
    },
    'Confirmed. This is now your record for the shift.',
  );
}

export async function raiseDisputeAction(input: {
  standardKey: string;
  itemId: string;
  month: string;
  explanation: string;
}): Promise<Result<{ id: string }>> {
  return call(
    'portal_raise_dispute',
    { p_key: input.standardKey, p_item_id: input.itemId, p_month: input.month, p_explanation: input.explanation },
    'Sent to your manager. You will see their decision and reason here.',
  );
}

export async function ackFeedbackAction(feedbackId: string, reply: string): Promise<Result> {
  return call('portal_ack_feedback', { p_feedback_id: feedbackId, p_reply: reply || null }, reply ? 'Acknowledged, and your reply was sent.' : 'Acknowledged.');
}

export async function selfReviewAction(line: string): Promise<Result> {
  return call('portal_submit_self_review', { p_focus_line: line }, 'Saved. Your manager reads this before writing your feedback.');
}

export async function setAvailabilityAction(windows: { iso_day: number; starts: string; ends: string }[], timeZone: string): Promise<Result> {
  return call('portal_set_availability', { p_windows: windows, p_time_zone: timeZone }, 'Saved. DA sees this when placing people.');
}

export async function setEmailPrefsAction(optional: boolean): Promise<Result> {
  return call('portal_set_email_prefs', { p_optional: optional }, optional ? 'Optional emails are on.' : 'Optional emails are off.');
}

export async function replyFormalNoticeAction(noticeId: string, reply: string): Promise<Result> {
  return call('portal_reply_formal_notice', { p_notice_id: noticeId, p_reply: reply }, 'Your reply is on the record.');
}

/** The exact items behind one standard, for the VA to check the maths. Read-only. */
export async function standardItemsAction(standardKey: string, month: string): Promise<Result<StandardItems>> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<StandardItems>(supabase, 'portal_standard_items', {
    p_key: standardKey,
    p_month: month,
  });
  if (error) return { ok: false, error: readable(error) };
  return { ok: true, data: data ?? undefined };
}
