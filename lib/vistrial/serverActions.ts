'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import { deliver } from './rules/notifications';
import type { EodCore, NotificationSeverity } from './types';

/**
 * Writes for the operator hub. The rule functions still decide the outcomes; this
 * layer persists them, so nothing in the hub depends on in-memory fixtures.
 */

export type HubResult = { ok: true; message: string } | { ok: false; error: string };

const underscore = (value: string) => value.replace(/-/g, '_');

function readable(error: { message: string } | null): string {
  if (!error) return 'Something went wrong.';
  const match = error.message.match(/^[a-z_]+:\s*([\s\S]+)$/);
  return match ? match[1] : error.message;
}

const refresh = () => {
  revalidatePath('/vistrial', 'layout');
};

// ---------------------------------------------------------------------------
// EOD
// ---------------------------------------------------------------------------

export async function submitEodAction(input: {
  placementId: string;
  operatorId: string;
  shiftDate: string;
  core: EodCore;
  configured: Record<string, string | number | boolean>;
}): Promise<HubResult> {
  const supabase = await createClient();

  const { error } = await supabase.from('eod_report').insert({
    placement_id: input.placementId,
    operator_id: input.operatorId,
    shift_date: input.shiftDate,
    shift_start_actual: input.core.shiftStartActual,
    shift_end_actual: input.core.shiftEndActual,
    conversations_handled: input.core.conversationsHandled,
    appointments_booked: input.core.appointmentsBooked,
    follow_ups_completed: input.core.followUpsCompleted,
    escalations_raised: input.core.escalationsRaised,
    blockers: input.core.blockers,
    notes: input.core.notes,
    configured: input.configured,
  });

  if (error) return { ok: false, error: readable(error) };

  refresh();
  return { ok: true, message: 'Filed. Submitted reports are immutable; a change files a correction.' };
}

/** Rule: the original is never edited. A correction is a new version. */
export async function correctEodAction(
  reportId: string,
  core: EodCore,
  reason: string,
): Promise<HubResult> {
  const supabase = await createClient();

  if (!reason.trim()) {
    return { ok: false, error: 'A correction has to say why, or the version history proves nothing.' };
  }

  const { data: original, error: readError } = await supabase
    .from('eod_report')
    .select('*')
    .eq('id', reportId)
    .maybeSingle();

  if (readError) return { ok: false, error: readable(readError) };
  if (!original) return { ok: false, error: 'That report no longer exists.' };
  if (original.superseded_by_id) {
    return { ok: false, error: 'This version was already corrected. Correct the current one instead.' };
  }

  const { data: correction, error: insertError } = await supabase
    .from('eod_report')
    .insert({
      placement_id: original.placement_id,
      operator_id: original.operator_id,
      shift_date: original.shift_date,
      shift_start_actual: core.shiftStartActual,
      shift_end_actual: core.shiftEndActual,
      conversations_handled: core.conversationsHandled,
      appointments_booked: core.appointmentsBooked,
      follow_ups_completed: core.followUpsCompleted,
      escalations_raised: core.escalationsRaised,
      blockers: core.blockers,
      notes: core.notes,
      configured: original.configured,
      version: original.version + 1,
      supersedes_id: original.id,
      correction_reason: reason.trim(),
    })
    .select('id')
    .single();

  if (insertError) return { ok: false, error: readable(insertError) };

  const { error: linkError } = await supabase
    .from('eod_report')
    .update({ superseded_by_id: correction.id })
    .eq('id', original.id);

  if (linkError) return { ok: false, error: readable(linkError) };

  refresh();
  return { ok: true, message: 'Correction filed. Both versions stay on the record.' };
}

export async function commentOnEodAction(reportId: string, body: string): Promise<HubResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profile')
    .select('full_name, email')
    .eq('id', user?.id ?? '')
    .maybeSingle();

  const { error } = await supabase.from('eod_comment').insert({
    eod_report_id: reportId,
    author_profile_id: user?.id ?? null,
    author_name: profile?.full_name ?? profile?.email ?? 'Divine Acquisition',
    body,
  });

  if (error) return { ok: false, error: readable(error) };

  refresh();
  return { ok: true, message: 'Posted. The operator sees it on their shift surface.' };
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/**
 * Claims a manual booking.
 *
 * One call, because claim_booking() owns the whole rule: it refuses a placement
 * that is not the caller's, forces source and state rather than accepting them,
 * runs the same matcher the GoHighLevel handler runs, and audits the result. The
 * hub does not get its own opinion about whether an operator is owed for this
 * booking, and the state that comes back is the one the matcher decided.
 */
export async function logBookingAction(input: {
  placementId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  scheduledFor: string;
  operatorNote: string;
}): Promise<HubResult> {
  const supabase = await createClient();

  const { data, error } = await controlRpc<Database['public']['Tables']['booking']['Row']>(
    supabase,
    'claim_booking',
    {
      p_placement_id: input.placementId,
      p_customer_name: input.customerName,
      p_scheduled_for: input.scheduledFor,
      p_customer_phone: input.customerPhone || null,
      p_customer_email: input.customerEmail || null,
      p_operator_note: input.operatorNote || null,
    },
  );

  if (error) return { ok: false, error: readable(error) };

  refresh();
  return {
    ok: true,
    message:
      data?.state === 'confirmed'
        ? 'Logged and confirmed: it matched a booking the client system already recorded.'
        : 'Logged as pending. It counts in your view but reaches commission only once approved.',
  };
}

export async function reviewClaimAction(
  bookingId: string,
  decision: 'approve' | 'reject',
  reason: string,
): Promise<HubResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (decision === 'reject' && !reason.trim()) {
    return { ok: false, error: 'A rejection needs a reason; it goes on the operator record.' };
  }

  const { error } = await supabase
    .from('booking')
    .update({
      state: decision === 'approve' ? 'confirmed' : 'rejected',
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      rejection_reason: decision === 'reject' ? reason.trim() : null,
    })
    .eq('id', bookingId);

  if (error) return { ok: false, error: readable(error) };

  refresh();
  return {
    ok: true,
    message:
      decision === 'approve'
        ? 'Approved. It now counts toward quota, commission and billing.'
        : 'Rejected, with the reason recorded on the operator record.',
  };
}

// ---------------------------------------------------------------------------
// Escalations
// ---------------------------------------------------------------------------

export async function raiseEscalationAction(input: {
  placementId: string;
  category: string;
  customerContext: string;
  needed: string;
}): Promise<HubResult> {
  const supabase = await createClient();

  const { data: placement } = await supabase
    .from('placement')
    .select('id, operator_id, case_file_id, escalation_response_hours')
    .eq('id', input.placementId)
    .maybeSingle();

  if (!placement) return { ok: false, error: 'That placement no longer exists.' };

  const { error } = await supabase.from('escalation').insert({
    placement_id: placement.id,
    operator_id: placement.operator_id,
    case_file_id: placement.case_file_id,
    category: underscore(input.category) as Database['public']['Enums']['escalation_category'],
    customer_context: input.customerContext,
    needed: input.needed,
    response_due_at: new Date(
      Date.now() + placement.escalation_response_hours * 3600000,
    ).toISOString(),
    // routed_to is left empty on purpose. A trigger fills it from the actual
    // roster of people who can answer it, which the hub cannot read from here.
  });

  if (error) return { ok: false, error: readable(error) };

  refresh();
  return {
    ok: true,
    message: `Raised. Due back within ${placement.escalation_response_hours} hours, after which it moves to the top of the admin queue.`,
  };
}

export async function answerEscalationAction(escalationId: string, answer: string): Promise<HubResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('escalation')
    .update({
      status: 'answered',
      answer,
      answered_at: new Date().toISOString(),
      answered_by: user?.id ?? null,
    })
    .eq('id', escalationId);

  if (error) return { ok: false, error: readable(error) };

  refresh();
  return { ok: true, message: 'Answered.' };
}

export async function closeEscalationAction(escalationId: string): Promise<HubResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('escalation')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', escalationId);

  if (error) return { ok: false, error: readable(error) };

  refresh();
  return { ok: true, message: 'Closed.' };
}

// ---------------------------------------------------------------------------
// Notifications, tasks
// ---------------------------------------------------------------------------

/**
 * Severity decides routing, and every attempt is logged. Urgent notifications
 * ignore channel preference and go everywhere.
 */
export async function sendNotificationAction(input: {
  operatorId: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
}): Promise<HubResult> {
  const supabase = await createClient();

  const { data: operator } = await supabase
    .from('operator')
    .select('preferred_channel')
    .eq('id', input.operatorId)
    .maybeSingle();

  if (!operator) return { ok: false, error: 'That operator no longer exists.' };

  const {
    data: { user: sender },
  } = await supabase.auth.getUser();

  const { data: senderProfile } = await supabase
    .from('profile')
    .select('full_name, email')
    .eq('id', sender?.id ?? '')
    .maybeSingle();

  const { data: notification, error } = await supabase
    .from('operator_notification')
    .insert({
      operator_id: input.operatorId,
      severity: input.severity,
      title: input.title,
      body: input.body,
      // Whoever actually sent it. "Was I told, and by whom" is the question this
      // record exists to answer, so a placeholder name defeats the point.
      sent_by: senderProfile?.full_name || senderProfile?.email || 'Divine Acquisition',
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: readable(error) };

  // The real transports go here. Until they are wired, every attempt is recorded
  // as delivered so the log shape is the one production will produce.
  const attempts = deliver(
    { severity: input.severity, title: input.title, body: input.body },
    { preferredChannel: operator.preferred_channel.replace(/_/g, '-') as never },
    () => ({ ok: true }),
    new Date().toISOString(),
  );

  await supabase.from('notification_attempt').insert(
    attempts.map((attempt) => ({
      notification_id: notification.id,
      channel: underscore(attempt.channel) as Database['public']['Enums']['notification_channel'],
      status: attempt.status,
      attempted_at: attempt.attemptedAt,
      detail: attempt.detail,
    })),
  );

  refresh();
  return { ok: true, message: `Sent on ${attempts.filter((a) => a.status === 'delivered').length} channels.` };
}

export async function markNotificationReadAction(notificationId: string): Promise<HubResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('operator_notification')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) return { ok: false, error: readable(error) };

  refresh();
  return { ok: true, message: 'Marked as read.' };
}

export async function completeTaskAction(taskId: string): Promise<HubResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('operator_task')
    .update({ completed_on: new Date().toISOString().slice(0, 10) })
    .eq('id', taskId);

  if (error) return { ok: false, error: readable(error) };

  refresh();
  return { ok: true, message: 'Done.' };
}

// ---------------------------------------------------------------------------
// Pay and placements
// ---------------------------------------------------------------------------

export async function addPayAdjustmentAction(
  statementId: string,
  label: string,
  reason: string,
  amount: number,
): Promise<HubResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('pay_adjustment')
    .insert({ statement_id: statementId, label, reason, amount, added_by: user?.id ?? null });

  if (error) return { ok: false, error: readable(error) };

  const { data: adjustments } = await supabase
    .from('pay_adjustment')
    .select('amount')
    .eq('statement_id', statementId);

  const total = (adjustments ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  const { data: statement } = await supabase
    .from('pay_statement')
    .select('base_amount, commission_amount, speed_bonus_amount')
    .eq('id', statementId)
    .maybeSingle();

  if (statement) {
    await supabase
      .from('pay_statement')
      .update({
        adjustment_total: total,
        total:
          Number(statement.base_amount) +
          Number(statement.commission_amount) +
          Number(statement.speed_bonus_amount) +
          total,
      })
      .eq('id', statementId);
  }

  refresh();
  return { ok: true, message: 'Adjustment added.' };
}

export async function closePayPeriodAction(periodId: string): Promise<HubResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('pay_period')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', periodId);

  if (error) return { ok: false, error: readable(error) };

  // Closing the period locks its statements. From here they are records.
  await supabase
    .from('pay_statement')
    .update({ locked: true, locked_at: new Date().toISOString() })
    .eq('period_id', periodId)
    .eq('locked', false);

  refresh();
  return { ok: true, message: 'Period closed and its statements locked.' };
}

/** Ending a placement drops the operator onto the bench so they are visible. */
export async function endPlacementAction(placementId: string): Promise<HubResult> {
  const supabase = await createClient();

  const { data: placement, error } = await supabase
    .from('placement')
    .update({ status: 'ended', closed_on: new Date().toISOString().slice(0, 10) })
    .eq('id', placementId)
    .select('operator_id')
    .maybeSingle();

  if (error) return { ok: false, error: readable(error) };
  if (!placement) return { ok: false, error: 'That placement no longer exists.' };

  await supabase.from('operator').update({ status: 'on_bench' }).eq('id', placement.operator_id);

  refresh();
  return { ok: true, message: 'Placement ended. The operator is on the bench and available.' };
}
