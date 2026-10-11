import { describe, expect, it } from 'vitest';
import { formatSlotTime } from '@/lib/calendar/slots';
import { goSlotsForDate, isGoOpenDate } from './slots';

const now = new Date('2026-09-01T12:00:00Z');

describe('cleaning strategy slots', () => {
  it('opens Sunday, Monday, Wednesday, and Thursday only', () => {
    expect(isGoOpenDate('2026-10-04')).toBe(true);
    expect(isGoOpenDate('2026-10-05')).toBe(true);
    expect(isGoOpenDate('2026-10-07')).toBe(true);
    expect(isGoOpenDate('2026-10-08')).toBe(true);
    expect(isGoOpenDate('2026-10-03')).toBe(false);
    expect(isGoOpenDate('2026-10-06')).toBe(false);
    expect(isGoOpenDate('2026-10-09')).toBe(false);
  });

  it('offers 6:00 AM, 7:00 AM, and 6:00 PM', () => {
    const slots = goSlotsForDate('2026-10-05', 'America/New_York', now);
    expect(slots.map((slot) => formatSlotTime(slot, 'America/New_York'))).toEqual([
      '6:00 AM',
      '7:00 AM',
      '6:00 PM',
    ]);
  });
});
