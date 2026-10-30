import { NextResponse, type NextRequest } from 'next/server';
import { runSalesReports } from '@/lib/sales-reports/deliver';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Every 15 minutes: open due reports, send approved ones, and retry a failed destination on its own. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const summary = await runSalesReports();
  return NextResponse.json(summary, { status: summary.ok ? 200 : 207 });
}
