import { continueFromAuthEmail } from '@/lib/auth/callback';
import type { NextRequest } from 'next/server';

/** Password-reset links land here, on the host that sent them. */
export function GET(request: NextRequest) {
  return continueFromAuthEmail(request, '/academy/reset-password', '/academy/forgot-password?link=expired');
}
