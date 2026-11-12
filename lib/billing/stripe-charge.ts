import 'server-only';

/**
 * Charges a client's card on file for one billing week through a Stripe
 * invoice: the invoice gets one line per charge (operator pay, commission,
 * management fee), is finalized, then paid with the customer's default
 * payment method. Every call carries an idempotency key, so a double click or
 * a retry cannot charge twice. An open (unpaid) invoice for a different amount
 * is voided before a new one is made.
 */

const STRIPE_API = 'https://api.stripe.com/v1';

export type ChargeLine = { description: string; amountCents: number };

export type ChargeResult =
  | { ok: true; invoiceId: string; status: string; hostedUrl: string | null; amountPaid: number }
  | { ok: false; invoiceId: string | null; status: string | null; error: string };

type StripeInvoice = {
  id: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  hosted_invoice_url: string | null;
};

let activeKey = '';

function stripeKey(): string {
  return activeKey || process.env.STRIPE_SECRET_KEY?.trim() || '';
}

function form(params: Record<string, string | number | undefined>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) body.set(key, String(value));
  return body;
}

class StripeError extends Error {
  constructor(
    message: string,
    public code: string | null,
  ) {
    super(message);
  }
}

async function stripe<T>(method: 'GET' | 'POST' | 'DELETE', path: string, params: Record<string, string | number | undefined>, key?: string): Promise<T> {
  const url = new URL(`${STRIPE_API}${path}`);
  const headers: Record<string, string> = { Authorization: `Bearer ${stripeKey()}` };
  let body: URLSearchParams | undefined;
  if (method !== 'POST') {
    for (const [name, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(name, String(value));
  } else {
    body = form(params);
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (key) headers['Idempotency-Key'] = key;
  }
  const response = await fetch(url, { method, headers, body, cache: 'no-store' });
  const json = (await response.json().catch(() => ({}))) as { error?: { message?: string; code?: string; decline_code?: string } } & T;
  if (!response.ok) {
    const error = json.error ?? {};
    throw new StripeError(error.message || `Stripe returned ${response.status}`, error.decline_code || error.code || null);
  }
  return json;
}

export async function chargeWeek(input: {
  /** The key to charge with; defaults to STRIPE_SECRET_KEY on the server. */
  apiKey?: string;
  customerId: string;
  chargeId: string;
  /** Changes when the amounts change, so a corrected week gets a new invoice. */
  fingerprint: string;
  description: string;
  lines: ChargeLine[];
  /** The open invoice from an earlier, unpaid attempt, if any. */
  existingInvoiceId: string | null;
  metadata: Record<string, string>;
}): Promise<ChargeResult> {
  activeKey = input.apiKey?.trim() || '';
  if (!stripeKey()) {
    return { ok: false, invoiceId: null, status: null, error: 'Stripe is not connected: STRIPE_SECRET_KEY is not set on the server.' };
  }
  const lines = input.lines.filter((line) => line.amountCents > 0);
  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  if (totalCents <= 0) return { ok: false, invoiceId: null, status: null, error: 'There is nothing to charge for this week.' };

  const base = `da-week-${input.chargeId}-${input.fingerprint}`;
  let invoice: StripeInvoice | null = null;
  let draftId: string | null = null;

  try {
    if (input.existingInvoiceId) {
      const existing = await stripe<StripeInvoice>('GET', `/invoices/${encodeURIComponent(input.existingInvoiceId)}`, {});
      if (existing.status === 'paid') {
        return { ok: true, invoiceId: existing.id, status: existing.status, hostedUrl: existing.hosted_invoice_url, amountPaid: existing.amount_paid };
      }
      if (existing.amount_due === totalCents && existing.status === 'open') {
        invoice = existing;
      } else if (existing.status === 'open') {
        await stripe('POST', `/invoices/${existing.id}/void`, {}, `${base}-void-${existing.id}`);
      } else if (existing.status === 'draft' && existing.amount_due === totalCents) {
        // An earlier attempt stopped before finalizing. Finish that invoice.
        invoice = await stripe<StripeInvoice>('POST', `/invoices/${existing.id}/finalize`, { auto_advance: 'false' }, `${base}-finalize`);
      } else if (existing.status === 'draft') {
        await stripe('DELETE', `/invoices/${existing.id}`, {}).catch(() => null);
      }
    }

    if (!invoice) {
      const draft = await stripe<StripeInvoice>(
        'POST',
        '/invoices',
        {
          customer: input.customerId,
          collection_method: 'charge_automatically',
          auto_advance: 'false',
          pending_invoice_items_behavior: 'exclude',
          description: input.description,
          ...Object.fromEntries(Object.entries(input.metadata).map(([name, value]) => [`metadata[${name}]`, value])),
        },
        `${base}-invoice`,
      );
      draftId = draft.id;
      for (const [index, line] of lines.entries()) {
        await stripe(
          'POST',
          '/invoiceitems',
          {
            customer: input.customerId,
            invoice: draft.id,
            currency: 'usd',
            amount: line.amountCents,
            description: line.description,
          },
          `${base}-line-${index}`,
        );
      }
      invoice = await stripe<StripeInvoice>('POST', `/invoices/${draft.id}/finalize`, { auto_advance: 'false' }, `${base}-finalize`);
    }

    if (invoice.status === 'paid') {
      return { ok: true, invoiceId: invoice.id, status: invoice.status, hostedUrl: invoice.hosted_invoice_url, amountPaid: invoice.amount_paid };
    }
    // A fresh key per attempt on an open invoice: Stripe replays a stored
    // decline for a reused key, and an invoice can only be paid once.
    const paid = await stripe<StripeInvoice>('POST', `/invoices/${invoice.id}/pay`, {}, `${base}-pay-${Date.now()}`);
    if (paid.status !== 'paid') {
      return { ok: false, invoiceId: paid.id, status: paid.status, error: `Stripe left the invoice ${paid.status}.` };
    }
    return { ok: true, invoiceId: paid.id, status: paid.status, hostedUrl: paid.hosted_invoice_url, amountPaid: paid.amount_paid };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe did not respond.';
    const code = error instanceof StripeError && error.code ? ` (${error.code})` : '';
    return { ok: false, invoiceId: invoice?.id ?? draftId, status: invoice?.status ?? (draftId ? 'draft' : null), error: `${message}${code}` };
  }
}
