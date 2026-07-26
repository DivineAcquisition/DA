import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Reads for the client-facing surface.
 *
 * Rule 2: the never-see list is enforced by the query layer, not by hidden
 * interface elements. There is deliberately no function here for the effort log,
 * the decisions log, the scope log, operators, pay, payouts, DA revenue, margin,
 * or unpublished reports — and if one were added, RLS would return nothing for a
 * client session anyway.
 */

export type ClientAccount = Database['public']['Tables']['client_account']['Row'];
export type Invoice = Database['public']['Tables']['invoice']['Row'];
export type InvoiceLine = Database['public']['Tables']['invoice_line']['Row'];

export type FunnelSummary = {
  period: { start: string; end: string };
  totals: {
    leads: number;
    booked: number;
    shows: number;
    closed: number;
    revenue: number;
    reactivation_revenue: number;
    ad_spend: number;
    within_standard: number;
    avg_response_minutes: number | null;
  };
  rates: {
    booking_rate: number | null;
    show_rate: number | null;
    close_rate: number | null;
    response_compliance: number | null;
    cost_per_lead: number | null;
    cost_per_booking: number | null;
    return_on_spend: number | null;
  };
  by_source: {
    source: string;
    leads: number;
    booked: number;
    shows: number;
    closed: number;
    revenue: number;
    ad_spend: number;
  }[];
  weekly: { week: string; leads: number; booked: number; revenue: number; avg_response_minutes: number | null }[];
};

/** The one engagement this account is bound to. Rule 1. */
export async function getMyAccount() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('client_account')
    .select('*, client_case_file(id, name, slug, vertical, status, engagement_start, install_started_at)')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getFunnel(caseFileId: string, start: string, end: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('client_funnel', {
    p_case_file_id: caseFileId,
    p_period_start: start,
    p_period_end: end,
  });
  if (error) throw error;
  return data as unknown as FunnelSummary;
}

export async function getGrowth(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('growth_for_case_file', { p_case_file_id: caseFileId });
  if (error) throw error;
  return data ?? [];
}

export async function getMilestones(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('milestone')
    .select('id, occurred_on, type, title, description')
    .eq('case_file_id', caseFileId)
    .order('occurred_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Only reports DA has explicitly published. RLS enforces it as well. */
export async function getPublishedReports(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('growth_report')
    .select('id, period_start, period_end, published_to_client_at, payload')
    .eq('case_file_id', caseFileId)
    .not('published_to_client_at', 'is', null)
    .order('published_to_client_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getInvoices(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoice')
    .select('*, invoice_line(id, description, quantity, unit_amount, amount, booking_id), credit_note(id, amount, reason, issued_at)')
    .eq('case_file_id', caseFileId)
    .order('issued_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMyUploads(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('evidence_item')
    .select('id, filename, what_it_proves, happened_on, drive_url, uploaded_at, uploaded_by_client, reviewed_by_admin_at')
    .eq('case_file_id', caseFileId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMyMessages(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('client_message')
    .select('*')
    .eq('case_file_id', caseFileId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMyPreferences() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('client_notification_pref').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

/** The last 30 days by default: what the dashboard opens on. */
export function defaultPeriod() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
