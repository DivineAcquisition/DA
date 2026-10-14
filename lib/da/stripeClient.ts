import {
  chooseStripeCustomer,
  dateFromUnix,
  mapSubscriptionStatus,
  paidInvoicePayload,
  subscriptionAmountDollars,
  type LedgerInvoice,
  type StripeCustomerHit,
  type StripeInvoiceInput,
  type SubscriptionStatus,
} from './stripe';

const STRIPE_API = 'https://api.stripe.com/v1';

export type StripePull = {
  customerId: string;
  subscriptionId: string | null;
  amount: number | null;
  status: SubscriptionStatus;
  cancelledOn: string | null;
  invoices: LedgerInvoice[];
};

type StripeList<T> = { data: T[]; has_more: boolean };

function stripeKey(): string {
  return process.env.STRIPE_SECRET_KEY?.trim() || '';
}

export function stripeConfigured(): boolean {
  return Boolean(stripeKey());
}

async function stripeGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${STRIPE_API}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${stripeKey()}` },
    cache: 'no-store',
  });
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message || 'Stripe refused the request.');
  }
  return body;
}

/**
 * Paid invoices and the subscription for one engagement.
 * Uses the saved customer when the case file already has one, so a second
 * Stripe customer on the same email is left alone.
 */
export async function pullStripeRevenue(input: {
  name: string;
  email: string | null;
  stripeCustomerId: string | null;
}): Promise<StripePull> {
  if (!stripeConfigured()) {
    throw new Error('Add STRIPE_SECRET_KEY on the server to pull new payments.');
  }

  let customerId = input.stripeCustomerId?.trim() || '';
  if (!customerId) {
    const email = input.email?.trim();
    if (!email) throw new Error('This engagement has no contact email to match in Stripe.');
    const found = await stripeGet<StripeList<StripeCustomerHit>>('/customers/search', {
      query: `email:'${email.replace(/'/g, "\\'")}'`,
      limit: '10',
    });
    const chosen = chooseStripeCustomer(found.data ?? [], input.name, null);
    if (!chosen) throw new Error('No Stripe customer uses this contact email.');
    customerId = chosen.id;
  }

  const invoices: LedgerInvoice[] = [];
  let startingAfter = '';
  for (let page = 0; page < 20; page += 1) {
    const params: Record<string, string> = { customer: customerId, status: 'paid', limit: '100' };
    if (startingAfter) params.starting_after = startingAfter;
    const listed = await stripeGet<StripeList<StripeInvoiceInput & { id: string }>>('/invoices', params);
    for (const invoice of listed.data ?? []) {
      const payload = paidInvoicePayload(invoice);
      if (payload) invoices.push(payload);
    }
    if (!listed.has_more || listed.data.length === 0) break;
    startingAfter = listed.data[listed.data.length - 1].id;
  }

  type Sub = {
    id: string;
    status: string;
    created: number;
    canceled_at: number | null;
    items?: { data?: { price?: { unit_amount?: number | null } }[] };
  };
  const subscriptions = await stripeGet<StripeList<Sub>>('/subscriptions', {
    customer: customerId,
    status: 'all',
    limit: '20',
  });
  const ordered = [...(subscriptions.data ?? [])].sort((a, b) => b.created - a.created);
  const live = ordered.find((subscription) => subscription.status === 'active' || subscription.status === 'past_due');
  const subscription = live ?? ordered[0] ?? null;

  return {
    customerId,
    subscriptionId: subscription?.id ?? null,
    amount: subscriptionAmountDollars(subscription?.items?.data?.[0]?.price?.unit_amount),
    status: mapSubscriptionStatus(subscription?.status),
    cancelledOn: dateFromUnix(subscription?.canceled_at),
    invoices,
  };
}
