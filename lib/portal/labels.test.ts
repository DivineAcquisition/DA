import { describe, expect, it } from 'vitest';
import {
  ATTENDANCE,
  bookingState,
  escalationCategory,
  ESCALATION_CATEGORY,
  escalationStatus,
  payoutStatus,
  TAX_STATUS,
  workingDays,
} from './labels';

const RAW = /^[a-z]+(_[a-z]+)+$/;

describe('portal labels', () => {
  it('never shows a raw status code for any booking state', () => {
    for (const state of ['confirmed', 'pending_review', 'rejected', 'system_only', 'something_new']) {
      const label = bookingState(state);
      expect(label.label).not.toMatch(RAW);
      expect(label.detail).not.toMatch(RAW);
    }
  });

  it('shows calendar bookings as counting', () => {
    expect(bookingState('system_only').detail).toMatch(/Counts toward quota/);
    expect(bookingState('pending_review').detail).toMatch(/doesn't count yet/);
  });

  it('labels a matched manual log that is not the credited record', () => {
    expect(bookingState('confirmed', false).label).toBe('Matched');
    expect(bookingState('confirmed', true).label).toBe('Confirmed');
  });

  it('explains every escalation category in a line', () => {
    for (const [key, item] of Object.entries(ESCALATION_CATEGORY)) {
      expect(escalationCategory(key)).toBe(item.label);
      expect(item.detail.length).toBeGreaterThan(10);
    }
    expect(escalationCategory('pricing_exception')).toBe('Pricing exception');
  });

  it('has plain labels for statuses, attendance, payouts and tax', () => {
    for (const s of ['open', 'answered', 'closed', 'unknown_thing']) expect(escalationStatus(s).label).not.toMatch(RAW);
    for (const item of Object.values(ATTENDANCE)) expect(item.label).not.toMatch(RAW);
    for (const s of ['pending', 'sent', 'confirmed', 'failed', 'returned']) expect(payoutStatus(s).label).not.toMatch(RAW);
    expect(TAX_STATUS.on_file.label).toBe('Approved');
  });

  it('describes working days', () => {
    expect(workingDays([1, 2, 3, 4, 5])).toBe('Mon to Fri');
    expect(workingDays([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(workingDays([1, 2, 3, 4, 5, 6, 7])).toBe('Every day');
  });
});
