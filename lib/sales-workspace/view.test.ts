import { describe, expect, it } from 'vitest';
import { deadlineLabel, firstName, NEXT_STATUSES, shiftLabel, statusFromDb } from './view';

const placement = {
  shift_start: '09:00',
  shift_end: '17:30',
  time_zone: 'America/New_York',
  working_days: [1, 2, 3, 4, 5],
  eod_deadline: '17:30',
};

describe('workspace labels', () => {
  const winter = new Date('2026-01-15T15:00:00Z');

  it('reads the shift with its zone and days', () => {
    expect(shiftLabel(placement, winter)).toBe('09:00–17:30 EST, Mon to Fri');
  });

  it('reads the deadline in the operator zone', () => {
    expect(deadlineLabel(placement, winter)).toBe('17:30 EST');
    expect(deadlineLabel({ eod_deadline: '18:00', time_zone: 'Asia/Manila' }, winter)).toMatch(/^18:00 (GMT\+8|PHT)$/);
  });

  it('takes the first name', () => {
    expect(firstName('Ana Reyes')).toBe('Ana');
    expect(firstName('  ')).toBe('');
    expect(firstName(null)).toBe('');
  });
});

describe('placement status', () => {
  it('names draft as Pending and renewed as Ended', () => {
    expect(statusFromDb('draft')).toBe('pending');
    expect(statusFromDb('renewed')).toBe('ended');
    expect(statusFromDb('paused')).toBe('paused');
  });

  it('never reopens an ended placement', () => {
    expect(NEXT_STATUSES.ended).toEqual([]);
    expect(NEXT_STATUSES.pending).toContain('active');
    expect(NEXT_STATUSES.paused).toEqual(['active', 'ended']);
  });
});
