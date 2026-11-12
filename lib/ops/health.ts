import { appUrl } from '@/lib/apps';
import { renderEmailHtml, textFooter } from '@/lib/email/layout';

export type HealthProblem = { area: string; problem: string; fix: string };

/** Deploy settings the app cannot work without, by name only. Values are never read out. */
export function configProblems(env: Record<string, string | undefined>): HealthProblem[] {
  const need: Array<[string[], string, string]> = [
    [['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'], 'Database', 'background jobs, billing and email cannot write to the database'],
    [['RESEND_API_KEY'], 'Email', 'no email can be sent'],
    [['CRON_SECRET'], 'Scheduled jobs', 'every scheduled job refuses to run'],
    [['STRIPE_SECRET_KEY'], 'Billing', 'weekly billing cannot charge a card'],
  ];
  return need
    .filter(([names]) => !names.some((name) => env[name]?.trim()))
    .map(([names, area, effect]) => ({
      area,
      problem: `${names[0]} is not set on this deploy, so ${effect}.`,
      fix: `Add ${names[0]} in Vercel, Settings, Environment Variables, then redeploy.`,
    }));
}

export function healthEmail(problems: HealthProblem[], day: string, env: Record<string, string | undefined> = process.env) {
  const count = problems.length;
  const subject = `DA health: ${count} thing${count === 1 ? '' : 's'} to fix (${day})`;
  const intro = `The daily check found ${count} problem${count === 1 ? '' : 's'}. Each one says what to do.`;
  const byArea = new Map<string, HealthProblem[]>();
  for (const problem of problems) byArea.set(problem.area, [...(byArea.get(problem.area) ?? []), problem]);
  const details = problems.map((problem) => ({ label: problem.area, value: `${problem.problem} ${problem.fix}` }));
  const reason = 'You received this because you are on the DA alerts list. It only sends when something needs fixing.';
  const href = `${appUrl('admin', env)}/workspace/team/ghl`;
  const html = renderEmailHtml({
    subject,
    preheader: problems[0]?.problem ?? intro,
    eyebrow: 'Daily health check',
    title: `${count} thing${count === 1 ? '' : 's'} to fix`,
    paragraphs: [intro],
    details,
    cta: { href, label: 'Open the admin workspace' },
    footer: { reason },
  });
  const text = [
    subject,
    '',
    intro,
    '',
    ...[...byArea.entries()].flatMap(([area, rows]) => [area, ...rows.map((row) => `- ${row.problem} ${row.fix}`), '']),
    `Admin workspace: ${href}`,
    '',
    ...textFooter({ reason }),
  ].join('\n');
  return { subject, html, text };
}
