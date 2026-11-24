import { describe, expect, it } from 'vitest';
import { findings, formatDraft, integrity, ruleDraft, type AnalysisData } from './biweekly';

const day = (date: string, over: Partial<AnalysisData['days'][number]> = {}): AnalysisData['days'][number] => ({
  date,
  status: 'submitted',
  submitted: true,
  late: false,
  excused: false,
  hours: 4,
  wins: 'Booked a walkthrough',
  blockers: 'No blockers today.',
  plan: 'Call back the quotes',
  needs_help: false,
  ...over,
});

const base: AnalysisData = {
  report: { id: 'r1', kind: 'biweekly', period_start: '2026-11-09', period_end: '2026-11-22', status: 'ready', auto_send_at: null },
  client: { operator: 'Matthew', client: 'Bay Area Cleaning Pros', outcomes: [{ name: 'Cleaning booked', value: 4, previous: 2, reported: true }] },
  placement: {
    id: 'pl',
    operator: 'Matthew Locsin',
    client: 'Bay Area Cleaning Pros',
    start_date: '2026-11-02',
    time_zone: 'America/Chicago',
    working_days: [1, 2, 3, 4, 5],
    categories: ['outbound_calling'],
    tracks_results: false,
  },
  days: [
    day('2026-11-09'),
    day('2026-11-10', { late: true }),
    day('2026-11-11', { submitted: false, status: 'missed', blockers: '' }),
    day('2026-11-12', { excused: true, submitted: false, status: 'excused' }),
    day('2026-11-13', { needs_help: true, blockers: 'The dialer kept dropping calls all afternoon.' }),
  ],
  metrics: [
    { key: 'dials_made', label: 'Dials made', unit: 'count', source: 'ghl', sort: 1, operator: null, ghl: 300, verified: null, previous: null, target: 500 },
    { key: 'conversations_held', label: 'Conversations held', unit: 'count', source: 'both', sort: 2, operator: 60, ghl: 52, verified: 52, previous: 80, target: 50 },
    { key: 'texts_sent', label: 'Texts sent', unit: 'count', source: 'both', sort: 3, operator: 90, ghl: null, verified: null, previous: 150, target: 100 },
  ],
  mismatches: [
    { date: '2026-11-10', metric: 'Conversations held', outcome: null, operator: 14, ghl: 8, gap: 6, status: 'open', decision: null },
    { date: '2026-11-09', metric: 'Texts sent', outcome: null, operator: 20, ghl: 19, gap: 1, status: 'dismissed', decision: 'dismiss' },
  ],
  ghl: { linked: true, status: 'active', last_success_at: '2026-11-22T20:00:00Z', last_error: null, synced_days: 3 },
  staff_emails: ['malik@example.com'],
};

describe('bi-weekly report analysis', () => {
  it('counts consistency and uses the verified number where GoHighLevel has one', () => {
    const f = findings(base);
    expect(f).toMatchObject({ firstName: 'Matthew', workdays: 4, submitted: 3, late: 1, missed: 1, excused: 1, helpDays: 1 });
    const conv = f.metrics.find((m) => m.key === 'conversations_held')!;
    expect(conv).toMatchObject({ value: 52, verified: true, pct: 104 });
    const texts = f.metrics.find((m) => m.key === 'texts_sent')!;
    expect(texts).toMatchObject({ value: 90, verified: false, pct: 90, change: -40 });
    expect(f.behind.map((m) => m.key)).toEqual(['dials_made']);
    expect(f.dropped.map((m) => m.key)).toEqual(['texts_sent', 'conversations_held']);
    expect(f.blockers).toEqual(['The dialer kept dropping calls all afternoon.']);
  });

  it('writes improvements and a 2-week focus from the numbers', () => {
    const draft = ruleDraft(findings(base));
    expect(draft.summary).toContain('Matthew submitted 3 of 4 end-of-day reports for Nov 9 – 22, 2026, 1 of them late.');
    expect(draft.improvements[0]).toContain('1 missed, 1 late');
    expect(draft.improvements.join(' ')).toContain('Raise dials made: 300 against a target of 500 (60%).');
    expect(draft.focus.join(' ')).toContain('Hit the dials made target of 500 over the next 2 weeks, about 50 a working day.');
    expect(draft.focus.join(' ')).toContain('aim for at least 5');
    const text = formatDraft(draft);
    expect(text.summary).toContain('\n\nWhat to improve:\n- ');
    expect(text.nextFocus.startsWith('- ')).toBe(true);
  });

  it('cross-checks against GoHighLevel for staff only', () => {
    const check = integrity(base);
    expect(check.state).toBe('verified');
    expect(check.open).toHaveLength(1);
    expect(check.lines.join('\n')).toContain('2026-11-10 · Conversations held: operator 14, GoHighLevel 8');
    expect(check.lines.join('\n')).toContain('1 earlier mismatch was already reviewed.');
  });

  it('says plainly when GoHighLevel could not check the numbers', () => {
    const check = integrity({ ...base, ghl: { linked: true, status: 'needs_attention', last_success_at: null, last_error: '401: The token is not authorized for this scope.', synced_days: 0 }, mismatches: [] });
    expect(check.state).toBe('unverified');
    expect(check.lines[0]).toContain('401: The token is not authorized for this scope.');
    const stale = integrity({ ...base, ghl: { linked: true, status: 'needs_attention', last_success_at: null, last_error: '401', synced_days: 4 }, mismatches: [] });
    expect(stale.state).toBe('unverified');
    expect(stale.lines.join(' ')).not.toContain('No mismatches');
    const unlinked = integrity({ ...base, ghl: { linked: false, status: null, last_success_at: null, last_error: null, synced_days: 0 }, mismatches: [] });
    expect(unlinked.lines[0]).toContain('not linked to a GoHighLevel user');
  });
});
