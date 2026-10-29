import { describe, expect, it } from 'vitest';
import { attentionRank, paceForMetric, paceForRow, presentTeamRow, worstPace, type TeamRow } from './team';

const base: TeamRow = {
  operator_id: 'op',
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  phone: null,
  placement_id: 'pl',
  client_name: 'Northside',
  placement_type: 'client_placed',
  placement_status: 'active',
  manager_id: 'mgr',
  manager_name: 'Morgan',
  shift_status: 'on_shift',
  time_zone: 'America/New_York',
  shift_start: '09:00',
  shift_end: '17:00',
  local_minutes: 13 * 60,
  working_day: true,
  eod_status: 'not_started',
  was_late: false,
  last_activity_at: null,
  last_activity_kind: null,
  tasks_open: 1,
  tasks_overdue: 0,
  alerts_unread: 0,
  certification: 'current',
  recertify_on: null,
  metrics: [
    { key: 'conversations_held', label: 'Conversations', operator: 4, ghl: 9, daily_target: 8, weekly_target: 40, pace: true },
  ],
  open_mismatch: true,
};

describe('pace', () => {
  it('hides the marker when no target is set', () => {
    expect(
      paceForMetric({
        value: 0,
        target: null,
        shiftStart: '09:00',
        shiftEnd: '17:00',
        nowMinutes: 12 * 60,
        onShift: true,
        workingDay: true,
      }),
    ).toBeNull();
  });

  it('is met at the target, on track halfway, and behind when short', () => {
    const shared = { target: 8, shiftStart: '09:00', shiftEnd: '17:00', nowMinutes: 13 * 60, onShift: true, workingDay: true };
    expect(paceForMetric({ ...shared, value: 8 })).toBe('met');
    expect(paceForMetric({ ...shared, value: 4 })).toBe('on_track');
    expect(paceForMetric({ ...shared, value: 1 })).toBe('behind');
  });

  it('stays on track before the shift starts and falls behind after it ends', () => {
    expect(
      paceForMetric({
        value: 0,
        target: 8,
        shiftStart: '09:00',
        shiftEnd: '17:00',
        nowMinutes: 8 * 60,
        onShift: false,
        workingDay: true,
      }),
    ).toBe('on_track');
    expect(
      paceForMetric({
        value: 3,
        target: 8,
        shiftStart: '09:00',
        shiftEnd: '17:00',
        nowMinutes: 18 * 60,
        onShift: false,
        workingDay: true,
      }),
    ).toBe('behind');
  });

  it('uses the worst marker and ignores GHL-only metrics', () => {
    expect(worstPace(['met', 'on_track', null])).toBe('on_track');
    expect(worstPace(['met', 'behind'])).toBe('behind');
    expect(
      paceForRow({
        ...base,
        metrics: [
          { key: 'dials_made', label: 'Dials', operator: null, daily_target: 40, weekly_target: null, pace: false },
          { key: 'conversations_held', label: 'Conversations', operator: 8, daily_target: 8, weekly_target: null },
        ],
      }),
    ).toBe('met');
  });
});

describe('attention and admin-only fields', () => {
  it('raises late, overdue, grace, and behind ahead of the rest', () => {
    const rank = (patch: Partial<TeamRow>) => attentionRank({ ...presentTeamRow({ ...base, ...patch }, true), ...patch });
    expect(rank({ eod_status: 'late' })).toBeLessThan(rank({ tasks_overdue: 2, eod_status: 'draft' }));
    expect(rank({ needs_help: true, eod_status: 'submitted' })).toBe(rank({ eod_status: 'late' }));
    expect(rank({ escalated: true, eod_status: 'submitted' })).toBe(0);
    expect(rank({ tasks_overdue: 1, eod_status: 'draft' })).toBeLessThan(rank({ certification: 'grace', eod_status: 'draft', tasks_overdue: 0 }));
    expect(rank({ certification: 'grace', eod_status: 'submitted', tasks_overdue: 0 })).toBeLessThan(
      rank({
        eod_status: 'submitted',
        certification: 'current',
        tasks_overdue: 0,
        metrics: [{ key: 'conversations_held', label: 'Conversations', operator: 0, daily_target: 8, weekly_target: null, pace: true }],
      }),
    );
    expect(
      rank({
        eod_status: 'submitted',
        certification: 'current',
        tasks_overdue: 0,
        metrics: [{ key: 'conversations_held', label: 'Conversations', operator: 0, daily_target: 8, weekly_target: null, pace: true }],
      }),
    ).toBe(3);
  });

  it('strips GHL numbers and the mismatch marker for a manager', () => {
    const manager = presentTeamRow(base, false);
    expect(manager.metrics[0].ghl).toBeUndefined();
    expect(manager.open_mismatch).toBeUndefined();
    expect(manager.metrics[0].operator).toBe(4);
    const admin = presentTeamRow(base, true);
    expect(admin.metrics[0].ghl).toBe(9);
    expect(admin.open_mismatch).toBe(true);
  });
});
