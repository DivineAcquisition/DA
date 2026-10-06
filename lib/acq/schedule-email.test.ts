import { describe, expect, it } from 'vitest';
import { acqAuditCc, buildAcqAuditEmail } from './schedule-email';

describe('acquisition audit email', () => {
  const email = buildAcqAuditEmail({
    fullName: 'Jordan Blake',
    offer: 'A 12-week coaching program',
    startsAt: '2026-10-06T14:00:00.000Z',
    timeZone: 'America/New_York',
    meetUrl: 'https://meet.google.com/abc-defg-hij',
    kind: 'confirmation',
  });

  it('uses the logo, legal footer, and the roadmap note', () => {
    expect(email.html).toContain('/email-logo.png');
    expect(email.html).toContain('Privacy policy');
    expect(email.html).toContain('system roadmaps and blueprints');
    expect(email.html).toContain('do not actively manage ad campaigns');
    expect(email.text).toContain('offer positioning and messaging');
    expect(email.html).toContain('https://meet.google.com/abc-defg-hij');
  });

  it('copies Malik except when he is the recipient', () => {
    expect(acqAuditCc('jordan@example.com')).toEqual(['malik@divineacquisition.io']);
    expect(acqAuditCc('Malik@divineacquisition.io')).toEqual([]);
  });

  it('names the 24 hour and 2 hour reminders', () => {
    expect(
      buildAcqAuditEmail({
        fullName: 'Jordan Blake',
        startsAt: '2026-10-06T14:00:00.000Z',
        timeZone: 'America/New_York',
        kind: 'reminder_24h',
      }).subject,
    ).toContain('24 hours');
    expect(
      buildAcqAuditEmail({
        fullName: 'Jordan Blake',
        startsAt: '2026-10-06T14:00:00.000Z',
        timeZone: 'America/New_York',
        kind: 'reminder_2h',
      }).html,
    ).toContain('2 hours');
  });
});
