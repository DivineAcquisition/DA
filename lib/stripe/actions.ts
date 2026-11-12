'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { checkStripeKey, findStripeCustomers, readStripeCustomer, resolveStripeKey, type StripeCustomerView } from './connection';

function refresh() {
  revalidatePath('/workspace/team/stripe');
  revalidatePath('/workspace/billing');
}

/** Admin only: the database refuses anyone else before anything is stored. */
async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'stripe_connection_status', {});
  return !error;
}

export async function connectStripeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: 'Only DA Admin connects Stripe.' };
  const key = String(formData.get('key') ?? '').trim();
  const check = await checkStripeKey(key);
  if (!check.ok) return { ok: false, error: check.error };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'stripe_connection_save', {
    p_key: key,
    p_account_id: check.accountId,
    p_account_name: check.accountName,
    p_livemode: check.livemode,
  });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return {
    ok: true,
    message: `Connected${check.accountName ? ` to ${check.accountName}` : ''} in ${check.livemode ? 'live' : 'test'} mode. Billing charges with this key.`,
  };
}

export async function disconnectStripeAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'stripe_connection_remove', {});
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'Disconnected. Billing cannot charge cards until Stripe is connected again.' };
}

export async function findCustomersAction(email: string): Promise<{ ok: true; customers: StripeCustomerView[] } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'Only DA Admin can search Stripe.' };
  const key = await resolveStripeKey();
  if (!key) return { ok: false, error: 'Connect Stripe first.' };
  if (!email.includes('@')) return { ok: false, error: 'This client has no contact email to search with.' };
  return findStripeCustomers(key.key, email);
}

export async function linkClientAction(caseFileId: string, customerId: string): Promise<ActionResult> {
  const id = customerId.trim();
  if (id) {
    const key = await resolveStripeKey();
    if (!key) return { ok: false, error: 'Connect Stripe first.' };
    const found = await readStripeCustomer(key.key, id);
    if (!found.ok) return { ok: false, error: found.error };
    if (found.customer.deleted) return { ok: false, error: 'That Stripe customer was deleted.' };
  }
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'stripe_link_client', { p_case_file_id: caseFileId, p_customer_id: id || null });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: id ? 'Linked.' : 'Unlinked.' };
}
