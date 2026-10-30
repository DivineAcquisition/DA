import { describe, expect, it } from 'vitest';
import { asClientReport, reportFileName, reportSubject } from './client';
import { buildClientReportEmail } from './email';
import { buildClientReportPdf } from './pdf';

const report = {
  test: false,
  kind: 'weekly' as const,
  client: 'Bay Area Cleaning Pros',
  operator: 'Alex',
  role: 'Sales Operator',
  manager: 'Sam',
  period_start: '2026-10-19',
  period_end: '2026-10-25',
  headline: [{ key: 'conversations_held', label: 'Conversations held', value: 12, target: 15, pace: 'behind' as const, reported: false }],
  outcomes: [],
  activity: [],
  speed: null,
  results: null,
  trend: [{ start: '2026-10-19', end: '2026-10-25', conversations: 12, outcomes: 3 }],
  wins: ['Booked the Tuesday route.'],
  summary: 'Calls landed.',
  next_focus: 'Work the no-shows.',
  plan: [],
  gaps: [{ date: '2026-10-21', label: 'No report submitted' }, { date: '2026-10-22', label: 'Scheduled day off' }],
  show_rate_note: null,
};

describe('client report payload', () => {
  it('refuses an internal field before it can be rendered', () => {
    expect(() => asClientReport({ ...report, blockers: 'the dialer was down' })).toThrow(/cannot leave/);
    expect(() => asClientReport({ ...report, mismatch: true })).toThrow(/cannot leave/);
  });

  it('names the file and the subject from the client and the period', () => {
    expect(reportFileName(report)).toBe('Bay Area Cleaning Pros - Weekly Report - 2026-10-19 to 2026-10-25.pdf');
    expect(reportSubject({ ...report, test: true })).toContain('TEST');
  });

  it('keeps a blocker string out of the email and the PDF', () => {
    const secret = 'SECRET BLOCKER TEXT THAT MUST NOT LEAK';
    const mail = buildClientReportEmail(report, { reportUrl: 'https://team.divineacquisition.io/r/abc' });
    const pdf = new TextDecoder().decode(buildClientReportPdf(report));
    expect(mail.html).not.toContain(secret);
    expect(mail.text).toContain('Conversations held: 12');
    expect(mail.html).toContain('View full report');
    expect(pdf).not.toContain(secret);
    expect(pdf).toContain('Devotion. Value. Exclusivity.');
    expect(pdf).toContain('No report submitted');
    expect(pdf).toContain('Scheduled day off');
  });
});
