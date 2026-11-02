import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recoveryTokenHash, resetNextPath } from './password';

/**
 * Turns a recovery link into a session on this host, then opens the reset
 * screen. Supabase's own mail uses a one-time `code`. Mail we send through
 * Resend carries `token_hash`. A bad or used link returns to forgot-password.
 */
export async function continueFromAuthEmail(request: NextRequest, fallbackNext: string, expiredPath: string) {
  const code = request.nextUrl.searchParams.get('code');
  const tokenHash = recoveryTokenHash(request.nextUrl.searchParams);
  const next = resetNextPath(request.nextUrl.searchParams.get('next'), fallbackNext);
  if (code || tokenHash) {
    const supabase = await createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
    }
    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
      if (!error) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
    }
  }
  return NextResponse.redirect(new URL(expiredPath, request.nextUrl.origin));
}
