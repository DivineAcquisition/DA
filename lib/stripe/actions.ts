'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { findStripeCustomers, readStripeCustomer, resolveStripeKey, type StripeCustomerView } from './connection';

function refresh() {
  revalidatePath('/workspace/team/stripe');
  revalidatePath('/workspace/billing');
}

/** Admin only: the database refuses anyone else. */
async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'stripe_clients', {});
  return !error;
}

export async function findCustomersAction(email: string): Promise<{ ok: true; customers: StripeCustomerView[] } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'Only DA Admin can search Stripe.' };
  const key = await resolveStripeKey();
  if (!key) return { ok: false, error: 'Stripe is not connected: STRIPE_SECRET_KEY is not set on the deploy.' };
  if (!email.includes('@')) return { ok: false, error: 'This client has no contact email to search with.' };
  return findStripeCustomers(key.key, email);
}

export async function linkClientAction(caseFileId: string, customerId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: 'Only DA Admin links clients to Stripe.' };
  const id = customerId.trim();
  if (id) {
    const key = await resolveStripeKey();
    if (!key) return { ok: false, error: 'Stripe is not connected: STRIPE_SECRET_KEY is not set on the deploy.' };
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
