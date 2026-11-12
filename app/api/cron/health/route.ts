import { NextResponse, type NextRequest } from 'next/server';
import { idempotencyKey } from '@/lib/email/policy';
import { loadEmailIdentity, sendAppEmail } from '@/lib/email/service';
import { configProblems, healthEmail, type HealthProblem } from '@/lib/ops/health';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Daily health check. Reads what is wrong (GoHighLevel tokens, stalled sales
 * numbers, failed or stuck email, end-of-day letters, failed database jobs,
 * missing deploy settings) and emails the alerts inbox when the list is not
 * empty. Nothing is sent on a clean day.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const problems: HealthProblem[] = configProblems(process.env);
  const { serviceRoleClient } = await import('@/lib/workspace/db');
  const db = serviceRoleClient();
  if (db) {
    const { data, error } = await db.rpc('ops_health');
    if (error) problems.push({ area: 'Health check', problem: `The database check failed: ${error.message}`, fix: 'Check the ops_health function.' });
    else if (Array.isArray(data)) problems.push(...(data as HealthProblem[]));
  }

  if (!problems.length) return NextResponse.json({ ok: true, problems: 0, sent: false });

  const identity = await loadEmailIdentity('alerts');
  const to = identity.replyTo;
  if (!to) return NextResponse.json({ ok: false, problems: problems.length, sent: false, error: 'no alerts inbox set' });

  const day = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
  const mail = healthEmail(problems, day);
  const result = await sendAppEmail({
    purpose: 'alerts',
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    template: 'ops.health',
    idempotencyKey: idempotencyKey(['ops-health', new Date().toISOString().slice(0, 10)]),
    event: 'ops.health',
    payload: { problems: problems.length, areas: [...new Set(problems.map((problem) => problem.area))] },
  });
  return NextResponse.json({ ok: result.ok, problems: problems.length, sent: result.ok, status: result.status });
}
