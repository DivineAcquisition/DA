import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resetNextPath } from './password';

/**
 * Turns a Supabase recovery link into a session on this host, then opens the
 * reset screen. A bad or used link returns to the forgot-password page.
 */
export async function continueFromAuthEmail(request: NextRequest, fallbackNext: string, expiredPath: string) {
  const code = request.nextUrl.searchParams.get('code');
  const next = resetNextPath(request.nextUrl.searchParams.get('next'), fallbackNext);
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  }
  return NextResponse.redirect(new URL(expiredPath, request.nextUrl.origin));
}
