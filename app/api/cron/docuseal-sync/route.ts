import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { syncDocuSeal } from '@/lib/workspace/sync';
import type { DaSettings } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Vercel Cron pulls DocuSeal on a schedule so agreements created outside the
 * workspace still land here, and so forms waiting on a signature keep getting
 * pre-filled. Authenticated with CRON_SECRET; needs the service role key
 * because there is no admin session on a cron request.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is required for the DocuSeal pull' },
      { status: 500 },
    );
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await supabase.from('da_settings').select('*').eq('id', 1).maybeSingle();
  if (!data) {
    return NextResponse.json({ ok: false, error: 'workspace settings not found' }, { status: 503 });
  }

  const row = data as Record<string, unknown>;
  const settings: DaSettings = {
    ...(row as unknown as DaSettings),
    auto_prefill: row.auto_prefill !== false,
    prefill_readonly: row.prefill_readonly === true,
    last_synced_at: (row.last_synced_at as string | null) ?? null,
  };

  const result = await syncDocuSeal(supabase as never, settings);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, ...result.counts });
}
