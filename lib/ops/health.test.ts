import { describe, expect, it } from 'vitest';
import { configProblems, healthEmail } from './health';

describe('daily health check', () => {
  it('names each missing setting without reading any value', () => {
    const problems = configProblems({ SUPABASE_SECRET_KEY: 'x', RESEND_API_KEY: 'x', CRON_SECRET: '' });
    expect(problems.map((row) => row.area)).toEqual(['Scheduled jobs', 'Billing']);
    expect(problems[1].problem).toContain('STRIPE_SECRET_KEY is not set');
    expect(configProblems({ SUPABASE_SERVICE_ROLE_KEY: 'x', RESEND_API_KEY: 'x', CRON_SECRET: 'x', STRIPE_SECRET_KEY: 'x' })).toEqual([]);
  });

  it('writes one email that lists every problem with its fix', () => {
    const mail = healthEmail(
      [
        { area: 'GoHighLevel', problem: 'Bay Area Cleaning Pros: the token is missing 9 of its scopes.', fix: 'Save a new token.' },
        { area: 'Sales numbers', problem: 'Matthew Locsin: not synced since Nov 2.', fix: 'Fix the token.' },
      ],
      'Nov 12',
      { NEXT_PUBLIC_ADMIN_ORIGIN: 'https://admin.example.com' },
    );
    expect(mail.subject).toBe('DA health: 2 things to fix (Nov 12)');
    expect(mail.text).toContain('- Bay Area Cleaning Pros: the token is missing 9 of its scopes. Save a new token.');
    expect(mail.html).toContain('Sales numbers');
  });
});
