import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Password-reset links land here, on the host that sent them. The code becomes
 * a session cookie for this host only, then the person continues to `next`.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const nextParam = request.nextUrl.searchParams.get('next') ?? '/academy';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/academy';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  }
  return NextResponse.redirect(new URL('/academy?link=expired', request.nextUrl.origin));
}
