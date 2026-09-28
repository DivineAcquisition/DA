import { describe, expect, it } from 'vitest';
import { formatDuration, fromLocalInput, shiftPhase, toLocalInput } from './time';

describe('portal time', () => {
  it('round-trips a wall-clock time in a zone', () => {
    expect(fromLocalInput('2026-09-28T14:30', 'America/New_York')).toBe('2026-09-28T18:30:00.000Z');
    expect(fromLocalInput('2026-09-28T09:00', 'Asia/Manila')).toBe('2026-09-28T01:00:00.000Z');
    expect(toLocalInput('2026-09-28T18:30:00.000Z', 'America/New_York')).toBe('2026-09-28T14:30');
  });

  it('formats durations', () => {
    expect(formatDuration(135 * 60000)).toBe('2h 15m');
    expect(formatDuration(40 * 60000)).toBe('40m');
    expect(formatDuration(-5000)).toBe('0m');
  });

  it('says where the shift is', () => {
    const today = { starts_at: '2026-09-28T13:00:00Z', ends_at: '2026-09-28T21:00:00Z' };
    expect(shiftPhase(Date.parse('2026-09-28T11:00:00Z'), today, today)).toEqual({ phase: 'starts_in', in: '2h 0m' });
    expect(shiftPhase(Date.parse('2026-09-28T17:20:00Z'), today, today)).toEqual({ phase: 'on_shift', left: '3h 40m' });
    expect(shiftPhase(Date.parse('2026-09-28T22:00:00Z'), today, null)).toEqual({ phase: 'over' });
    expect(shiftPhase(Date.parse('2026-09-28T22:00:00Z'), null, null)).toEqual({ phase: 'none' });
  });
});
