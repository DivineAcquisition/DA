import { describe, expect, it } from 'vitest';
import { buildScheduledCallEmail } from './email';

describe('buildScheduledCallEmail', () => {
  it('frames internal booking notices as pending until deposit, not confirmed', () => {
    const content = buildScheduledCallEmail({
      fullName: 'Ada Lovelace',
      companyName: 'Analytical Engines',
      startsAt: '2026-08-10T15:00:00.000Z',
      timeZone: 'UTC',
      durationMinutes: 30,
      kind: 'confirmation',
    });

    expect(content.subject).toMatch(/^Pending:/);
    expect(content.subject).not.toMatch(/Confirmed/i);
    expect(content.text).toMatch(/pending until your deposit is received/i);
    expect(content.text).not.toMatch(/is confirmed/i);
    expect(content.html).toMatch(/pending until deposit/i);
    expect(content.html).not.toMatch(/is confirmed/i);
  });

  it('keeps reminder copy focused on timing', () => {
    const content = buildScheduledCallEmail({
      fullName: 'Ada Lovelace',
      startsAt: '2026-08-10T15:00:00.000Z',
      timeZone: 'UTC',
      durationMinutes: 30,
      kind: 'reminder',
    });

    expect(content.subject).toMatch(/^Reminder:/);
    expect(content.text).toMatch(/starts in about 30 minutes/i);
  });
});
