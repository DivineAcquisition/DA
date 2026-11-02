import { describe, expect, it } from 'vitest';
import {
  extensionAllowed,
  formComplete,
  nextHireStage,
  readinessComplete,
  reminderDue,
  setupFlags,
  stepErrors,
  type OnboardingDraft,
  type ReadinessItem,
} from './rules';

const ready = (state: ReadinessItem['state']): ReadinessItem => ({
  key: 'account',
  label: 'Account',
  state,
  detail: '',
});

describe('hire stage', () => {
  it('follows the facts in order and does not treat a waiver as optional for the move', () => {
    expect(nextHireStage({ signedIn: false, readinessMet: false, placement: 'none', offboarded: false, current: 'invited' })).toBe('invited');
    expect(nextHireStage({ signedIn: true, readinessMet: false, placement: 'none', offboarded: false, current: 'invited' })).toBe('onboarding');
    expect(nextHireStage({ signedIn: true, readinessMet: true, placement: 'none', offboarded: false, current: 'onboarding' })).toBe('ready');
    expect(nextHireStage({ signedIn: true, readinessMet: true, placement: 'active', offboarded: false, current: 'ready' })).toBe('placed');
    expect(nextHireStage({ signedIn: true, readinessMet: true, placement: 'paused', offboarded: false, current: 'placed' })).toBe('paused');
    expect(nextHireStage({ signedIn: true, readinessMet: true, placement: 'active', offboarded: true, current: 'placed' })).toBe('offboarded');
  });

  it('counts a waiver toward ready and never calls it met', () => {
    const items = [
      ready('met'), ready('met'), ready('waived'), ready('met'), ready('met'), ready('met'), ready('met'),
    ].map((item, index) => ({ ...item, key: (['account', 'onboarding', 'agreement', 'payout', 'academy', 'setup', 'manager'] as const)[index] }));
    expect(readinessComplete(items)).toBe(true);
    expect(items.find((item) => item.key === 'agreement')?.state).toBe('waived');
    expect(readinessComplete(items.map((item) => (item.key === 'setup' ? { ...item, state: 'flagged' } : item)))).toBe(false);
  });
});

describe('override length and reminders', () => {
  it('allows 30 and 60 days and refuses a longer grant without an exception', () => {
    expect(extensionAllowed('2026-11-02', '2026-12-02', false).ok).toBe(true);
    expect(extensionAllowed('2026-11-02', '2027-01-01', false).ok).toBe(true);
    expect(extensionAllowed('2026-11-02', '2027-01-15', false).ok).toBe(false);
    expect(extensionAllowed('2026-11-02', '2027-01-15', true).ok).toBe(true);
  });

  it('reminds at 48 hours, three times', () => {
    const start = new Date('2026-11-01T15:00:00Z');
    expect(reminderDue(start, 0, new Date('2026-11-03T14:00:00Z'))).toBe(false);
    expect(reminderDue(start, 0, new Date('2026-11-03T15:00:00Z'))).toBe(true);
    expect(reminderDue(start, 2, new Date('2026-11-07T15:00:00Z'))).toBe(true);
    expect(reminderDue(start, 3, new Date('2026-12-01T15:00:00Z'))).toBe(false);
  });
});

const draft: OnboardingDraft = {
  legal_name: 'Martin Locsin',
  preferred_name: 'Martin',
  mobile: '+14155550123',
  discord: 'martin',
  city: 'Oakland',
  region: 'California',
  country: 'United States',
  time_zone: 'America/Los_Angeles',
  weekly_hours: '30_40',
  work_days: 'Monday to Friday',
  work_hours: '9:00 to 17:00',
  earliest_start: '2026-11-16',
  us_zones: ['pacific'],
  years: '1_2',
  roles: ['sdr'],
  verticals: ['home_services'],
  laptop: 'yes',
  internet: 'yes',
  internet_speed: '80 down, 20 up',
  headset: 'yes',
  quiet: 'yes',
  emergency_name: 'Ana Locsin',
  emergency_relationship: 'Sister',
  emergency_phone: '+14155550199',
  ack_academy: true,
  ack_gates: true,
  ack_logins: true,
  ack_confidential: true,
  ack_eod: true,
  ack_myself: true,
  why: 'I want the work. I like a clear standard.',
  skill: 'First calls',
  year_goal: 'Placed and certified',
};

describe('onboarding form', () => {
  it('accepts a complete draft and refuses to store a payout secret in the step check', () => {
    expect(formComplete(draft, true)).toBe(true);
    expect(formComplete(draft, false)).toBe(false);
    expect(stepErrors(5, draft, false)[0]).toMatch(/payout record/i);
    expect(JSON.stringify(draft)).not.toMatch(/account number|routing/i);
  });

  it('lets a setup "no" through and flags it', () => {
    const flagged = { ...draft, headset: 'no' };
    expect(stepErrors(4, flagged, true)).toEqual([]);
    expect(setupFlags(flagged)).toEqual(['headset']);
  });
});
