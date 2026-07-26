'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { ActionResult } from './actions';

function readable(error: { message: string } | null): string {
  if (!error) return 'Something went wrong.';
  const match = error.message.match(/^[a-z_]+:\s*([\s\S]+)$/);
  return match ? match[1] : error.message;
}

// ---------------------------------------------------------------------------
// Money in
// ---------------------------------------------------------------------------

/**
 * Rule 4 lives in the database function: it draws only confirmed bookings and
 * refuses if there are none. The admin cannot override that from here.
 */
export async function buildPerformanceInvoiceAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('build_performance_invoice', {
    p_case_file_id: String(formData.get('case_file_id')),
    p_period_start: String(formData.get('period_start')),
    p_period_end: String(formData.get('period_end')),
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da/billing');
  return { ok: true, message: 'Draft built from confirmed bookings only. Review it, then issue.' };
}

export async function createFixedInvoiceAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_invoice_draft', {
    p_case_file_id: String(formData.get('case_file_id')),
    p_charge_type: formData.get('charge_type') as Database['public']['Enums']['charge_type'],
    p_period_start: (formData.get('period_start') as string) || undefined,
    p_period_end: (formData.get('period_end') as string) || undefined,
    p_due_at: (formData.get('due_at') as string) || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  const invoice = data as unknown as Database['public']['Tables']['invoice']['Row'];

  const { error: lineError } = await supabase.rpc('add_invoice_line', {
    p_invoice_id: invoice.id,
    p_description: String(formData.get('description')),
    p_unit_amount: Number(formData.get('amount')),
  });

  if (lineError) return { ok: false, error: readable(lineError) };

  revalidatePath('/da/billing');
  return { ok: true, message: 'Draft created. Review it, then issue.' };
}

export async function issueInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('issue_invoice', { p_invoice_id: invoiceId });

  if (error) return { ok: false, error: readable(error) };

  const invoice = data as unknown as Database['public']['Tables']['invoice']['Row'];

  revalidatePath('/da/billing');
  return { ok: true, message: `${invoice.number} issued. It is frozen now; corrections are credit notes.` };
}

export async function recordPaymentAction(
  invoiceId: string,
  status: Database['public']['Enums']['payment_attempt_status'],
  failureMessage?: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('record_payment', {
    p_invoice_id: invoiceId,
    p_status: status,
    p_failure_message: failureMessage || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da/billing');
  revalidatePath('/da/margin');
  return {
    ok: true,
    message:
      status === 'succeeded'
        ? 'Marked paid, and written into the revenue records.'
        : 'Recorded. The retry and reminder sequence has advanced a step.',
  };
}

export async function creditNoteAction(invoiceId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('issue_credit_note', {
    p_invoice_id: invoiceId,
    p_amount: Number(formData.get('amount')),
    p_reason: String(formData.get('reason') ?? ''),
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da/billing');
  return { ok: true, message: 'Credit note issued against the invoice.' };
}

export async function writeOffAction(invoiceId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('write_off_invoice', { p_invoice_id: invoiceId, p_reason: reason });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da/billing');
  return { ok: true, message: 'Written off.' };
}

export async function markOverdueAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('mark_overdue_invoices');

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da/billing');
  return { ok: true, message: `${data ?? 0} invoice(s) moved to overdue.` };
}

export async function suspendForBillingAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('suspend_for_billing', { p_threshold_days: 21 });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da/billing');
  return {
    ok: true,
    message: `${data ?? 0} engagement(s) suspended. Anyone whose billing has cleared was restored.`,
  };
}

// ---------------------------------------------------------------------------
// Money out
// ---------------------------------------------------------------------------

export async function buildBatchAction(periodId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('build_payout_batch', { p_period_id: periodId });

  if (error) return { ok: false, error: readable(error) };

  const batch = data as unknown as Database['public']['Tables']['payout_batch']['Row'];

  revalidatePath('/da/payouts');
  return { ok: true, message: `${batch.payout_count} payout(s) listed, ${batch.total_amount} in total.` };
}

export async function approveBatchAction(batchId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_payout_batch', { p_batch_id: batchId });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da/payouts');
  return { ok: true, message: 'Batch approved. Execute the transfers, then record each confirmation.' };
}

export async function confirmPayoutAction(payoutId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('confirm_payout', {
    p_payout_id: payoutId,
    p_sent_reference: String(formData.get('reference') ?? ''),
    p_method: (formData.get('method') as Database['public']['Enums']['payout_method']) || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da/payouts');
  revalidatePath('/da/margin');
  return { ok: true, message: 'Confirmed. The record is locked now.' };
}

export async function failPayoutAction(
  payoutId: string,
  reason: string,
  returned: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('fail_payout', {
    p_payout_id: payoutId,
    p_reason: reason,
    p_returned: returned,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da/payouts');
  return { ok: true, message: 'Flagged. The amount will roll into the next batch.' };
}

export async function updateTaxDocAction(operatorId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('operator')
    .update({
      tax_doc_status: formData.get('tax_doc_status') as Database['public']['Enums']['tax_doc_status'],
      tax_doc_reference: (formData.get('tax_doc_reference') as string) || null,
      tax_doc_reviewed_on: new Date().toISOString().slice(0, 10),
    })
    .eq('id', operatorId);

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da/payouts');
  return { ok: true, message: 'Documentation status updated. Only the status and the reference are stored.' };
}

// ---------------------------------------------------------------------------
// Client accounts
// ---------------------------------------------------------------------------

export async function inviteClientAction(caseFileId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('invite_client', {
    p_case_file_id: caseFileId,
    p_email: String(formData.get('email')),
    p_full_name: (formData.get('full_name') as string) || undefined,
    p_job_title: (formData.get('job_title') as string) || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  const invite = data as unknown as Database['public']['Tables']['client_invite']['Row'];

  revalidatePath('/da');
  return {
    ok: true,
    message: `Invite created, expiring ${invite.expires_at.slice(0, 10)}. Send them /acct/invite/${invite.token}`,
  };
}

export async function createShareLinkAction(caseFileId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_dashboard_link', {
    p_case_file_id: caseFileId,
    p_label: (formData.get('label') as string) || undefined,
    p_valid_days: Number(formData.get('valid_days') ?? 30),
    p_passphrase: (formData.get('passphrase') as string) || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  const link = data as unknown as Database['public']['Tables']['client_dashboard_link']['Row'];

  revalidatePath('/da');
  return { ok: true, message: `Link created: /share/${link.token} — expires ${link.expires_at.slice(0, 10)}` };
}

export async function answerMessageAction(messageId: string, answer: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('answer_client_message', {
    p_message_id: messageId,
    p_answer: answer,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da/messages');
  return { ok: true, message: 'Answered. The client sees it on their dashboard.' };
}

export async function publishReportAction(reportId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('publish_report', { p_report_id: reportId });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da');
  return { ok: true, message: 'Published. The client can now see it.' };
}

export async function archiveClientAction(caseFileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('archive_client_accounts', {
    p_case_file_id: caseFileId,
    p_window_days: 90,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da');
  return {
    ok: true,
    message: `${data ?? 0} account(s) moved to read-only for 90 days rather than being cut off.`,
  };
}
