import { describe, expect, it } from 'vitest';
import { menuFor, tabAllowed, zoneOf, zonesFor } from './zones';

const ctx = (stage: Parameters<typeof tabAllowed>[0], has_history = false) => ({ stage, has_history, has_pay: has_history });

describe('stage navigation', () => {
  it('gives a placed VA the five zones', () => {
    expect(zonesFor(ctx('placed')).map((z) => z.label)).toEqual([
      'My Day',
      'My Record',
      'My Standards',
      "DA's Commitments",
      'Pay & Growth',
    ]);
  });

  it('keeps a trainee away from live work', () => {
    for (const tab of ['bookings', 'escalations', 'reports', 'pay', 'record'] as const) {
      expect(tabAllowed('training', tab)).toBe(false);
    }
    expect(tabAllowed('training', 'playbook')).toBe(true);
    expect(tabAllowed('training', 'standards')).toBe(true);
  });

  it('shows an applicant only onboarding, agreements and profile', () => {
    expect(zonesFor(ctx('applicant')).map((z) => z.key)).toEqual(['today']);
    expect(menuFor(ctx('applicant')).map((z) => z.key)).toEqual(['profile', 'agreements', 'inbox']);
    expect(tabAllowed('applicant', 'standards')).toBe(false);
  });

  it('hides placement tabs from a certified VA with no history, keeps them after a placement ended', () => {
    expect(tabAllowed('waiting', 'bookings')).toBe(false);
    expect(tabAllowed('waiting', 'bookings', true)).toBe(true);
    expect(tabAllowed('waiting', 'availability')).toBe(true);
  });

  it('leaves an inactive VA only pay and agreements', () => {
    expect(zonesFor(ctx('inactive')).map((z) => z.key)).toEqual(['pay', 'agreements']);
    expect(tabAllowed('inactive', 'profile')).toBe(false);
    expect(tabAllowed('inactive', 'today')).toBe(false);
    expect(menuFor(ctx('inactive'))).toEqual([]);
  });

  it('files record pages under My Record', () => {
    expect(zoneOf('bookings')).toBe('record');
    expect(zoneOf('pay')).toBe('growth');
  });
});
