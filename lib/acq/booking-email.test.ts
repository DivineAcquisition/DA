import { describe, expect, it } from 'vitest';
import { buildProspectCallEmail } from './booking-email';

describe('buildProspectCallEmail', () => {
  it('confirms a Lead Leak Audit with Meet and company in the subject', () => {
    const content = buildProspectCallEmail({
      fullName: 'Jordan Blake',
      companyName: 'Blake Coaching',
      startsAt: '2026-08-27T18:00:00.000Z',
      timeZone: 'America/New_York',
      durationMinutes: 30,
      meetUrl: 'https://meet.google.com/abc-defg-hij',
      calendarUrl: 'https://calendar.google.com/event?eid=test',
    });

    expect(content.subject).toContain('Lead Leak Audit');
    expect(content.subject).toContain('Blake Coaching');
    expect(content.text).toContain('Hi Jordan,');
    expect(content.text).toContain('https://meet.google.com/abc-defg-hij');
    expect(content.text).toContain('— Divine Acquisition');
    expect(content.html).toContain('Join Google Meet');
    expect(content.html).toContain('Divine Acquisition');
    expect(content.html).not.toContain('Talent');
  });

  it('greets with the full name when the first token is a single letter', () => {
    const content = buildProspectCallEmail({
      fullName: 'J Blake',
      startsAt: '2026-08-27T18:00:00.000Z',
      timeZone: 'America/New_York',
      durationMinutes: 30,
    });
    expect(content.text).toContain('Hi J Blake,');
  });
});
