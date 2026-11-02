import { NextResponse } from 'next/server';
import { deliverAuthHook } from '@/lib/email/auth-hook';
import { verifySupabaseHook } from '@/lib/email/hook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Supabase Auth "Send Email" hook. When this is enabled, Supabase does not
 * send its own mail. We send from the security identity and log it.
 */
export async function POST(request: Request) {
  const secret = process.env.SUPABASE_AUTH_HOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'SUPABASE_AUTH_HOOK_SECRET is not set' }, { status: 503 });
  }
  const payload = await request.text();
  try {
    verifySupabaseHook(payload, {
      id: request.headers.get('webhook-id') ?? '',
      timestamp: request.headers.get('webhook-timestamp') ?? '',
      signature: request.headers.get('webhook-signature') ?? '',
    }, secret);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const result = await deliverAuthHook(body as Parameters<typeof deliverAuthHook>[0]);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
