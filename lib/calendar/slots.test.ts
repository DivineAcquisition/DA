import { describe, expect, it } from 'vitest';
import { isOfferedSlot, isWeekendDate, monthMatrix, slotsForDate } from './slots';

describe('applicant schedule slots', () => {
  it('skips weekends', () => {
    expect(isWeekendDate('2026-10-03')).toBe(true);
    expect(isWeekendDate('2026-10-04')).toBe(true);
    expect(isWeekendDate('2026-10-05')).toBe(false);
    expect(slotsForDate('2026-10-03', 'America/New_York', new Date('2026-09-01T12:00:00Z'))).toEqual([]);
  });

  it('offers 9:00 through 16:30 on a weekday', () => {
    const slots = slotsForDate('2026-10-05', 'America/New_York', new Date('2026-09-01T12:00:00Z'));
    expect(slots).toHaveLength(16);
    expect(isOfferedSlot(slots[0], 'America/New_York', new Date('2026-09-01T12:00:00Z'))).toBe(true);
    expect(isOfferedSlot(slots[15], 'America/New_York', new Date('2026-09-01T12:00:00Z'))).toBe(true);
  });

  it('drops times that are already in the past', () => {
    const slots = slotsForDate('2026-10-05', 'UTC', new Date('2026-10-05T15:10:00Z'));
    expect(slots.every((slot) => new Date(slot).getTime() >= Date.parse('2026-10-05T15:25:00Z'))).toBe(
      true,
    );
    expect(slots[0]).toBe('2026-10-05T15:30:00.000Z');
  });

  it('starts the month grid on Monday', () => {
    const weeks = monthMatrix(2026, 9);
    expect(weeks[0][0]).toBeNull();
    expect(weeks[0][3]).toBe('2026-10-01');
  });
});
