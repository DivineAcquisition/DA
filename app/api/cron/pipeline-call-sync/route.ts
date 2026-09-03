import { NextResponse, type NextRequest } from 'next/server';
import { drainUnsyncedProspectCalls } from '@/lib/calls/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Retries DA prospect-call rows that landed in Supabase but have not been
 * sent to Airtable (or failed on the last send). Authenticated with CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
  if (!serviceKey) {
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is required to drain unsynced calls' },
      { status: 500 },
    );
  }

  try {
    const result = await drainUnsyncedProspectCalls(40);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'drain failed' },
      { status: 500 },
    );
  }
}
