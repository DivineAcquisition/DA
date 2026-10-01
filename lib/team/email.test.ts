import { describe, expect, it } from 'vitest';
import { buildTeamEmail, recordUrl, type MailMessage } from './email';

const base = 'https://team.divineacquisition.io';

const single: MailMessage = {
  kind: 'single',
  operator_id: 'op',
  to: 'ana@example.test',
  first_name: 'Ana',
  preferred_channel: 'email',
  items: [
    {
      id: 'n1',
      subject: 'Your shift review for Tue, Oct 6 is ready',
      title: 'Your shift review for Tue, Oct 6 is ready',
      body: 'Hi Ana, your shift on Tue, Oct 6 has been recorded.\n\nStandard: every worked shift has a confirmed review.',
      link: '/vistrial/operator/record?review=2026-10-06',
      formal: false,
    },
  ],
};

describe('team email', () => {
  it('links to the exact record on the team host', () => {
    expect(recordUrl(base, '/vistrial/operator/record?review=2026-10-06')).toBe(
      'https://team.divineacquisition.io/operator/record?review=2026-10-06',
    );
    expect(recordUrl(`${base}/`, null)).toBe('https://team.divineacquisition.io/operator/inbox');
  });

  it('builds a single message with the record link', () => {
    const mail = buildTeamEmail(single, base);
    expect(mail.subject).toBe('Your shift review for Tue, Oct 6 is ready');
    expect(mail.text).toContain('Open the record: https://team.divineacquisition.io/operator/record?review=2026-10-06');
    expect(mail.html).toContain('href="https://team.divineacquisition.io/operator/record?review=2026-10-06"');
    expect(mail.html).toContain('DivineACQ Team');
  });

  it('batches a digest and drops each item greeting', () => {
    const digest: MailMessage = {
      ...single,
      kind: 'digest',
      items: [single.items[0], { ...single.items[0], id: 'n2', title: 'Your pay statement is ready', link: '/vistrial/operator/pay' }],
    };
    const mail = buildTeamEmail(digest, base);
    expect(mail.subject).toBe('2 updates from DivineACQ Team');
    expect(mail.text.match(/Hi Ana/g)?.length).toBe(1);
    expect(mail.text).toContain('https://team.divineacquisition.io/operator/pay');
  });

  it('escapes anything that looks like markup', () => {
    const mail = buildTeamEmail({ ...single, items: [{ ...single.items[0], body: '<script>x</script>' }] }, base);
    expect(mail.html).not.toContain('<script>');
  });
});
