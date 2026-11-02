import { NextResponse, type NextRequest } from 'next/server';
import { retryEmailLog } from '@/lib/email/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Retries queued and failed email that is due. Temporary failures wait longer each time. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const { serviceRoleClient } = await import('@/lib/workspace/db');
  const client = serviceRoleClient();
  if (!client) return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is required' }, { status: 500 });

  const { data, error } = await client.rpc('email_claim_due', { p_limit: 20 });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const ids = Array.isArray(data) ? (data as string[]) : [];
  let sent = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await retryEmailLog(String(id));
    if (result.ok) {
      sent += 1;
      continue;
    }
    failed += 1;
    if (result.error?.includes('content was not kept')) {
      await client
        .from('email_log')
        .update({ status: 'failed', error: result.error, attempt_count: 8, next_attempt_at: null, updated_at: new Date().toISOString() })
        .eq('id', id);
    }
  }
  return NextResponse.json({ ok: true, claimed: ids.length, sent, failed });
}
