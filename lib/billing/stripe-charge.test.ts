import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { chargeWeek } from './stripe-charge';

type Call = { method: string; path: string; key: string | null; body: string };

function fakeStripe(handler: (call: Call) => { status?: number; json: unknown }) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      const call = { method: init.method ?? 'GET', path: url.pathname.replace('/v1', ''), key: headers['Idempotency-Key'] ?? null, body: String(init.body ?? '') };
      calls.push(call);
      const reply = handler(call);
      return new Response(JSON.stringify(reply.json), { status: reply.status ?? 200 });
    }),
  );
  return calls;
}

const base = {
  customerId: 'cus_123',
  chargeId: 'wc-1',
  fingerprint: 'fp1',
  description: 'Week of Nov 2',
  lines: [
    { description: 'Pay', amountCents: 7266 },
    { description: 'Commission', amountCents: 0 },
    { description: 'Fee', amountCents: 10000 },
  ],
  existingInvoiceId: null,
  metadata: { weekly_charge_id: 'wc-1' },
};

describe('charging a week on Stripe', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('creates the invoice, adds the non-zero lines, finalizes, and pays, each with an idempotency key', async () => {
    const calls = fakeStripe((call) => {
      if (call.path === '/invoices') return { json: { id: 'in_1', status: 'draft', amount_due: 0, amount_paid: 0, hosted_invoice_url: null } };
      if (call.path === '/invoiceitems') return { json: { id: 'ii' } };
      if (call.path.endsWith('/finalize')) return { json: { id: 'in_1', status: 'open', amount_due: 17266, amount_paid: 0, hosted_invoice_url: 'https://inv' } };
      return { json: { id: 'in_1', status: 'paid', amount_due: 17266, amount_paid: 17266, hosted_invoice_url: 'https://inv' } };
    });
    const result = await chargeWeek(base);
    expect(result).toEqual({ ok: true, invoiceId: 'in_1', status: 'paid', hostedUrl: 'https://inv', amountPaid: 17266 });
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /invoices',
      'POST /invoiceitems',
      'POST /invoiceitems',
      'POST /invoices/in_1/finalize',
      'POST /invoices/in_1/pay',
    ]);
    expect(calls.every((call) => call.key?.startsWith('da-week-wc-1-fp1-'))).toBe(true);
    expect(calls[0].body).toContain('collection_method=charge_automatically');
    expect(calls[0].body).toContain('pending_invoice_items_behavior=exclude');
    expect(calls[1].body).toContain('amount=7266');
    expect(calls[2].body).toContain('amount=10000');
  });

  it('reports a declined card and keeps the open invoice for the next try', async () => {
    fakeStripe((call) => {
      if (call.path === '/invoices') return { json: { id: 'in_2', status: 'draft', amount_due: 0, amount_paid: 0, hosted_invoice_url: null } };
      if (call.path === '/invoiceitems') return { json: { id: 'ii' } };
      if (call.path.endsWith('/finalize')) return { json: { id: 'in_2', status: 'open', amount_due: 17266, amount_paid: 0, hosted_invoice_url: null } };
      return { status: 402, json: { error: { message: 'Your card was declined.', code: 'card_declined', decline_code: 'insufficient_funds' } } };
    });
    const result = await chargeWeek(base);
    expect(result).toEqual({ ok: false, invoiceId: 'in_2', status: 'open', error: 'Your card was declined. (insufficient_funds)' });
  });

  it('pays the open invoice from an earlier try, and voids one for a different amount', async () => {
    let calls = fakeStripe((call) => {
      if (call.method === 'GET') return { json: { id: 'in_3', status: 'open', amount_due: 17266, amount_paid: 0, hosted_invoice_url: null } };
      return { json: { id: 'in_3', status: 'paid', amount_due: 17266, amount_paid: 17266, hosted_invoice_url: null } };
    });
    expect((await chargeWeek({ ...base, existingInvoiceId: 'in_3' })).ok).toBe(true);
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /invoices/in_3', 'POST /invoices/in_3/pay']);

    calls = fakeStripe((call) => {
      if (call.method === 'GET') return { json: { id: 'in_4', status: 'open', amount_due: 9999, amount_paid: 0, hosted_invoice_url: null } };
      if (call.path === '/invoices') return { json: { id: 'in_5', status: 'draft', amount_due: 0, amount_paid: 0, hosted_invoice_url: null } };
      if (call.path.endsWith('/finalize')) return { json: { id: 'in_5', status: 'open', amount_due: 17266, amount_paid: 0, hosted_invoice_url: null } };
      return { json: { id: 'in_5', status: 'paid', amount_due: 17266, amount_paid: 17266, hosted_invoice_url: null } };
    });
    expect((await chargeWeek({ ...base, existingInvoiceId: 'in_4' })).ok).toBe(true);
    expect(calls[1]).toMatchObject({ method: 'POST', path: '/invoices/in_4/void' });
  });

  it('does nothing without a Stripe key or an amount', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect((await chargeWeek(base)).ok).toBe(false);
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    const calls = fakeStripe(() => ({ json: {} }));
    expect((await chargeWeek({ ...base, lines: [{ description: 'x', amountCents: 0 }] })).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
