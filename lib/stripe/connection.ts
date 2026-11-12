import 'server-only';

import { serviceRoleClient } from '@/lib/workspace/db';

const STRIPE_API = 'https://api.stripe.com/v1';

/**
 * The Stripe key billing charges with: the one connected in the admin
 * workspace (Account, Stripe), else STRIPE_SECRET_KEY on the deploy.
 */
export async function resolveStripeKey(): Promise<{ key: string; source: 'workspace' | 'deploy' } | null> {
  const db = serviceRoleClient();
  if (db) {
    const { data } = await db.rpc('stripe_connection_secret');
    if (typeof data === 'string' && data.trim()) return { key: data.trim(), source: 'workspace' };
  }
  const env = process.env.STRIPE_SECRET_KEY?.trim();
  return env ? { key: env, source: 'deploy' } : null;
}

export type StripeCheck =
  | { ok: true; accountId: string | null; accountName: string | null; livemode: boolean }
  | { ok: false; error: string };

async function get<T>(key: string, path: string, params: Record<string, string> = {}): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const url = new URL(`${STRIPE_API}${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.append(name, value);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
  const json = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) return { ok: false, status: response.status, error: json.error?.message ?? `Stripe returned ${response.status}` };
  return { ok: true, data: json };
}

/**
 * Checks a key before it is saved: it must reach Stripe and be able to read
 * customers and invoices, which charging needs. The account name is read when
 * the key is allowed to.
 */
export async function checkStripeKey(key: string): Promise<StripeCheck> {
  const trimmed = key.trim();
  if (!/^(sk|rk)_(live|test)_[A-Za-z0-9]{20,}$/.test(trimmed)) {
    return { ok: false, error: 'Paste a Stripe secret key (sk_live_...) or restricted key (rk_live_...).' };
  }
  const customers = await get<{ data: unknown[] }>(trimmed, '/customers', { limit: '1' });
  if (!customers.ok) {
    return {
      ok: false,
      error: customers.status === 401 ? 'Stripe did not accept that key.' : `The key cannot read customers: ${customers.error}`,
    };
  }
  const invoices = await get<{ data: unknown[] }>(trimmed, '/invoices', { limit: '1' });
  if (!invoices.ok) return { ok: false, error: `The key cannot read invoices: ${invoices.error}` };
  const account = await get<{ id?: string; settings?: { dashboard?: { display_name?: string } }; business_profile?: { name?: string } }>(trimmed, '/account');
  const name = account.ok ? account.data.settings?.dashboard?.display_name || account.data.business_profile?.name || null : null;
  return { ok: true, accountId: account.ok ? (account.data.id ?? null) : null, accountName: name, livemode: trimmed.includes('_live_') };
}

export type StripeCustomerView = {
  id: string;
  name: string | null;
  email: string | null;
  card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  deleted: boolean;
};

type CustomerJson = {
  id: string;
  deleted?: boolean;
  name?: string | null;
  email?: string | null;
  invoice_settings?: { default_payment_method?: { card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number } } | string | null };
};

function view(data: CustomerJson): StripeCustomerView {
  const pm = data.invoice_settings?.default_payment_method;
  const card = pm && typeof pm === 'object' ? pm.card : undefined;
  return {
    id: data.id,
    name: data.name ?? null,
    email: data.email ?? null,
    deleted: Boolean(data.deleted),
    card: card?.last4
      ? { brand: card.brand ?? 'card', last4: card.last4, expMonth: card.exp_month ?? 0, expYear: card.exp_year ?? 0 }
      : null,
  };
}

/** The customer and the card billing would charge (its default payment method). */
export async function readStripeCustomer(key: string, customerId: string): Promise<{ ok: true; customer: StripeCustomerView } | { ok: false; error: string }> {
  const result = await get<CustomerJson>(key, `/customers/${encodeURIComponent(customerId)}`, { 'expand[]': 'invoice_settings.default_payment_method' });
  if (!result.ok) return { ok: false, error: result.status === 404 ? 'No Stripe customer has that id.' : result.error };
  return { ok: true, customer: view(result.data) };
}

/** Stripe customers with this email, newest first. */
export async function findStripeCustomers(key: string, email: string): Promise<{ ok: true; customers: StripeCustomerView[] } | { ok: false; error: string }> {
  const result = await get<{ data: CustomerJson[] }>(key, '/customers', {
    email: email.trim().toLowerCase(),
    limit: '10',
    'expand[]': 'data.invoice_settings.default_payment_method',
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, customers: result.data.data.map(view) };
}
