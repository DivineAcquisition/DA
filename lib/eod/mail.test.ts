import { describe, expect, it } from 'vitest';
import { eodLetter } from './mail';

const env = {
  TEAM_APP_URL: 'https://team.divineacquisition.io',
  ADMIN_APP_URL: 'https://admin.divineacquisition.io',
};

const report = {
  name: 'Matthew Locsin',
  client: 'Bay Area Cleaning Pros',
  work_date: '2026-11-06',
  due_label: '1:30 PM',
  shift_label: '1:00 PM',
  time_zone: 'America/Chicago',
  wins: 'Booked two walkthroughs.',
  blockers: 'No blockers today.',
  plan: 'Call the morning list.',
  needs_help: false,
  was_late: false,
};

describe('end of day letters', () => {
  it('sends Matthew the private link thirty minutes before the shift ends', () => {
    const mail = eodLetter(
      'operator.eod_reminder',
      { ...report, to: ['matthew@divineacquisition.io'], link_path: '/eod/abc123' },
      env,
    );
    expect(mail.purpose).toBe('team');
    expect(mail.to).toEqual(['matthew@divineacquisition.io']);
    expect(mail.subject).toBe('Your end of day for Bay Area Cleaning Pros');
    expect(mail.html).toContain('https://team.divineacquisition.io/eod/abc123');
    expect(mail.html).toContain('1:00 PM Central');
    expect(mail.html).toContain('1:30 PM Central');
    expect(mail.html).not.toContain('/workspace/operator/workspace/eod');
    expect(mail.text).toContain('No sign-in.');
  });

  it('tells the client what was submitted and leaves out the edit link', () => {
    const mail = eodLetter(
      'client.eod_submitted',
      { ...report, to: ['admin1@bayareacleaningpros.com'], link_path: '/eod/secret', review_path: '/workspace/team/workspace/eods/1' },
      env,
    );
    expect(mail.purpose).toBe('client');
    expect(mail.to).toEqual(['admin1@bayareacleaningpros.com']);
    expect(mail.html).toContain('Booked two walkthroughs.');
    expect(mail.html).toContain('Call the morning list.');
    expect(mail.html).not.toContain('/eod/');
    expect(mail.html).not.toContain('/workspace/team/workspace/eods');
    expect(mail.text).not.toContain('/eod/');
  });

  it('sends Malik the same summary and the staff review link', () => {
    const mail = eodLetter(
      'manager.eod_submitted',
      {
        ...report,
        needs_help: true,
        was_late: true,
        to: ['malik@divineacquisition.io'],
        link_path: '/eod/secret',
        review_path: '/workspace/team/workspace/eods/efe30e55',
      },
      env,
    );
    expect(mail.purpose).toBe('team');
    expect(mail.to).toEqual(['malik@divineacquisition.io']);
    expect(mail.html).toContain('https://admin.divineacquisition.io/workspace/team/workspace/eods/efe30e55');
    expect(mail.html).toContain('He asked for manager help.');
    expect(mail.html).toContain('submitted late');
    expect(mail.html).not.toContain('/eod/');
  });
});
