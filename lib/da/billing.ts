import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

/** Payments administration reads. Admin-only via RLS. */

export type Invoice = Database['public']['Tables']['invoice']['Row'];
export type PayoutBatch = Database['public']['Tables']['payout_batch']['Row'];
export type Payout = Database['public']['Tables']['payout']['Row'];
export type MarginRow = Database['public']['Views']['v_margin_by_client']['Row'];

export async function listInvoices() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoice')
    .select(
      '*, client_case_file(name, slug), invoice_line(id, description, amount, booking_id), credit_note(id, amount, reason, issued_at), payment_attempt(id, status, amount, attempted_at, failure_message), dunning_event(id, step, action, occurred_at, next_attempt_at, detail)',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSubscriptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('subscription')
    .select('*, client_case_file(name, slug)')
    .order('started_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Confirmed bookings in a period with no invoice line yet: what is billable. */
export async function billableBookings(caseFileId: string, start: string, end: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('booking')
    .select('id, customer_name, scheduled_for, state, source, matched_booking_id')
    .eq('case_file_id', caseFileId)
    .gte('scheduled_for', `${start}T00:00:00Z`)
    .lte('scheduled_for', `${end}T23:59:59Z`)
    .order('scheduled_for');
  if (error) throw error;
  return data ?? [];
}

export async function listPayoutBatches() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payout_batch')
    .select('*, pay_period(start_date, end_date, closes_month, status)')
    .order('period_id', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listPayouts(batchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payout')
    .select('*, operator(name, email, payout_method, payout_reference, tax_doc_status), placement(case_file_id)')
    .eq('batch_id', batchId)
    .order('amount', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listPayPeriods() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('pay_period').select('*').order('start_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listOperators() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('operator').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listMargin() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_margin_by_client')
    .select('*')
    .order('margin_to_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listMonthlyMargin() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('v_monthly_margin').select('*').limit(12);
  if (error) throw error;
  return data ?? [];
}

export async function listOperatorMargin() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_margin_by_operator')
    .select('*')
    .order('paid_to_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listCaseFilesForBilling() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('client_case_file')
    .select('id, name, slug, status')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listClientMessages() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('client_message')
    .select('*, client_case_file(name, slug)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
