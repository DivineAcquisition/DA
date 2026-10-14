/**
 * Pure mapping from Stripe objects onto the engagement ledger.
 * Amounts on the wire are cents. The ledger stores dollars.
 */

export type SubscriptionStatus = 'active' | 'past_due' | 'paused' | 'cancelled';

export type StripeCustomerHit = { id: string; name: string | null; email: string | null };

export type StripeInvoiceInput = {
  id: string;
  number?: string | null;
  amount_paid?: number | null;
  status_transitions?: { paid_at?: number | null } | null;
  lines?: { data?: { description?: string | null }[] } | null;
};

export type LedgerInvoice = {
  id: string;
  number: string | null;
  amount: number;
  paid_at: string | null;
  description: string | null;
};

export function dollarsFromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function mapSubscriptionStatus(status: string | null | undefined): SubscriptionStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'canceled':
    case 'cancelled':
    case 'incomplete_expired':
      return 'cancelled';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'past_due';
    case 'paused':
      return 'paused';
    default:
      return 'active';
  }
}

/**
 * Prefer the customer already saved on the case file. Otherwise match the
 * client name, then the first email hit.
 */
export function chooseStripeCustomer(
  customers: StripeCustomerHit[],
  caseName: string,
  storedId: string | null,
): StripeCustomerHit | null {
  if (storedId) {
    return customers.find((customer) => customer.id === storedId) ?? { id: storedId, name: null, email: null };
  }
  const named = customers.find(
    (customer) => (customer.name ?? '').trim().toLowerCase() === caseName.trim().toLowerCase(),
  );
  return named ?? customers[0] ?? null;
}

/** Paid invoices only. A $0 trial invoice is not revenue. */
export function paidInvoicePayload(invoice: StripeInvoiceInput): LedgerInvoice | null {
  const amount = dollarsFromCents(invoice.amount_paid ?? 0);
  if (!invoice.id || amount <= 0) return null;
  const paidAt = invoice.status_transitions?.paid_at;
  return {
    id: invoice.id,
    number: invoice.number ?? null,
    amount,
    paid_at: paidAt ? new Date(paidAt * 1000).toISOString() : null,
    description: invoice.lines?.data?.[0]?.description ?? null,
  };
}

export function subscriptionAmountDollars(unitAmountCents: number | null | undefined): number | null {
  if (unitAmountCents == null || unitAmountCents <= 0) return null;
  return dollarsFromCents(unitAmountCents);
}

export function dateFromUnix(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}
