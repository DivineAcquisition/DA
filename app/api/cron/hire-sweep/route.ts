import { NextResponse, type NextRequest } from 'next/server';
import { runHireSweep } from '@/lib/hire/actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Onboarding reminders, override emails, and ready-to-place mail. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const summary = await runHireSweep();
  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
}
