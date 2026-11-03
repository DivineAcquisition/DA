import { NextResponse, type NextRequest } from 'next/server';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { eodToken } from '@/lib/sales-workspace/eod-link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Autosave for a private end-of-day link. The token in the body is the credential. */
export async function POST(request: NextRequest) {
  let payload: { token?: string; body?: Record<string, unknown> };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'The draft could not be read.' }, { status: 400 });
  }
  const token = eodToken(payload.token);
  if (!token || !payload.body || typeof payload.body !== 'object') {
    return NextResponse.json({ ok: false, error: 'This link is not valid.' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await controlRpc(supabase, 'so_eod_link_save', { p_token: token, p_body: payload.body });
  if (error) return NextResponse.json({ ok: false, error: readable(error) }, { status: 400 });
  return NextResponse.json({ ok: true, ...(data as object) });
}
