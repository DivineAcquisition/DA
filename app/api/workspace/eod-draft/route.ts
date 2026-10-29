import { NextResponse, type NextRequest } from 'next/server';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Autosave when the operator leaves the EOD form. The session cookie is the only auth. */
export async function POST(request: NextRequest) {
  let payload: { day?: string; body?: Record<string, unknown> };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'The draft could not be read.' }, { status: 400 });
  }
  if (!payload.day || !/^\d{4}-\d{2}-\d{2}$/.test(payload.day) || !payload.body) {
    return NextResponse.json({ ok: false, error: 'A working day is required.' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await controlRpc(supabase, 'so_eod_save', { p_day: payload.day, p_body: payload.body });
  if (error) return NextResponse.json({ ok: false, error: readable(error) }, { status: 400 });
  return NextResponse.json({ ok: true, ...(data as object) });
}
