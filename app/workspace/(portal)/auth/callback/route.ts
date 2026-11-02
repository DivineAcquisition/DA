import { continueFromAuthEmail } from '@/lib/auth/callback';
import type { NextRequest } from 'next/server';

/**
 * Where Supabase email links (password reset, and any future sign-in link)
 * land on the operator workspace and the admin app. The one-time code becomes
 * a session cookie for this host only, then the person sets a new password.
 */
export function GET(request: NextRequest) {
  return continueFromAuthEmail(request, '/workspace/reset-password', '/workspace/forgot-password?link=expired');
}
