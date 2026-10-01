import { NextResponse, type NextRequest } from 'next/server';
import { runWorker } from '@/lib/ghl/worker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Vercel Cron, every minute: the GHL worker (jobs, health, mapping,
 * reconciliation, conversation polling). The routing sweep, escalations and
 * access sync run in the database on pg_cron; this is the half that has to
 * reach GHL. The summary carries counts only, never anything from GHL.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const summary = await runWorker({ budgetMs: 50_000 });
  return NextResponse.json({ ok: summary.errors.length === 0, ...summary }, { status: summary.errors.length ? 207 : 200 });
}
