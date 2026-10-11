import { NextResponse, type NextRequest } from 'next/server';
import { secretsMatch } from '@/lib/booking-messages/auth';
import { readBookingMessageConfig } from '@/lib/booking-messages/config';
import { runDueMessages } from '@/lib/booking-messages/transport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Sends due booking messages. Vercel Cron hits this every minute, which is
 * the shortest cadence this host allows and is what the 15-minute reminder
 * needs. A missed run is picked up by the next one. A reminder that is past
 * its stale window is marked skipped instead of going out late.
 */
export async function GET(request: NextRequest) {
  const settings = readBookingMessageConfig();
  const header = request.headers.get('authorization') ?? '';
  const provided = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  // Without a secret on the deploy Vercel sends no Authorization header. The run
  // only sends what is already due, so the cron's user agent is accepted then.
  const fromCron = !settings.schedulerSecret && (request.headers.get('user-agent') ?? '').startsWith('vercel-cron/');
  if (!fromCron && !secretsMatch(provided, settings.schedulerSecret)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const summary = await runDueMessages();
  return NextResponse.json(summary, { status: summary.error ? 500 : 200 });
}
