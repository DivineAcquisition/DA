import { NextResponse, type NextRequest } from 'next/server';
import { dispatchEodMail } from '@/lib/eod/dispatch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Every minute: open due end-of-day steps, then send the queued letters. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const summary = await dispatchEodMail();
  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
}
