import { describe, expect, it } from 'vitest';
import {
  chooseStripeCustomer,
  dateFromUnix,
  dollarsFromCents,
  mapSubscriptionStatus,
  paidInvoicePayload,
} from './stripe';

describe('stripe ledger mapping', () => {
  it('converts cents to dollars', () => {
    expect(dollarsFromCents(9700)).toBe(97);
    expect(dollarsFromCents(0)).toBe(0);
  });

  it('maps Stripe canceled onto the ledger spelling', () => {
    expect(mapSubscriptionStatus('canceled')).toBe('cancelled');
    expect(mapSubscriptionStatus('active')).toBe('active');
    expect(mapSubscriptionStatus('past_due')).toBe('past_due');
  });

  it('keeps a stored customer ahead of another person who shares the email', () => {
    const customers = [
      { id: 'cus_person', name: 'Maurisa Alexis Louis', email: 'admin1@bayareacleaningpros.com' },
      { id: 'cus_business', name: 'Bay Area Cleaning Pros', email: 'admin1@bayareacleaningpros.com' },
    ];
    expect(chooseStripeCustomer(customers, 'Bay Area Cleaning Pros', 'cus_business')?.id).toBe('cus_business');
    expect(chooseStripeCustomer(customers, 'Bay Area Cleaning Pros', null)?.id).toBe('cus_business');
  });

  it('drops a zero-dollar trial and keeps a paid invoice', () => {
    expect(
      paidInvoicePayload({
        id: 'in_trial',
        number: '0001',
        amount_paid: 0,
        lines: { data: [{ description: 'Trial period for Selestial Essential' }] },
      }),
    ).toBeNull();
    expect(
      paidInvoicePayload({
        id: 'in_paid',
        number: '0002',
        amount_paid: 9700,
        status_transitions: { paid_at: 1741100527 },
        lines: { data: [{ description: '1 × Selestial Essential (at $97.00 / month)' }] },
      }),
    ).toMatchObject({
      id: 'in_paid',
      number: '0002',
      amount: 97,
      description: '1 × Selestial Essential (at $97.00 / month)',
    });
  });

  it('turns a unix cancellation into a date', () => {
    expect(dateFromUnix(1756999103)).toBe('2025-09-04');
    expect(dateFromUnix(null)).toBeNull();
  });
});
