import { describe, expect, it } from 'vitest';
import { buildGoSessionEmail, goReminderSms } from './reminders';

const when = {
  startsAt: '2026-10-08T14:00:00.000Z',
  timeZone: 'America/New_York',
  meetUrl: 'https://meet.google.com/abc-defg-hij',
};

describe('cleaning funnel reminders', () => {
  it('confirms the session and includes the Google Meet link', () => {
    const email = buildGoSessionEmail({ ...when, fullName: 'Jordan Blake', kind: 'confirmation' });
    expect(email.subject).toContain('Confirmed');
    expect(email.html).toContain('https://meet.google.com/abc-defg-hij');
    expect(email.html).toContain('Join Google Meet');
    expect(email.text).toContain('private room');
    expect(email.text).toContain('15 minutes before we start');
    expect(email.text.toLowerCase()).not.toContain('coach');
  });

  it('names the 24 hour and 2 hour emails', () => {
    expect(buildGoSessionEmail({ ...when, fullName: 'Jordan Blake', kind: 'reminder_24h' }).subject).toContain(
      '24 hours',
    );
    expect(buildGoSessionEmail({ ...when, fullName: 'Jordan Blake', kind: 'reminder_2h' }).html).toContain('2 hours');
  });

  it('sends email-and-text reminders at 24 and 2 hours, and the Meet link on the 15-minute text', () => {
    const sms24 = goReminderSms({ kind: 'sms_24h', when: 'Thursday', meetUrl: when.meetUrl });
    const sms2 = goReminderSms({ kind: 'sms_2h', when: 'Thursday', meetUrl: when.meetUrl });
    const sms15 = goReminderSms({ kind: 'sms_15m', when: 'Thursday', meetUrl: when.meetUrl });
    expect(sms24).toContain('24 hours');
    expect(sms2).toContain('2 hours');
    expect(sms15).toContain('15 minutes');
    expect(sms15).toContain('https://meet.google.com/abc-defg-hij');
    expect(sms15).toContain('STOP');
  });
});
