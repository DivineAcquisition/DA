import { continueFromAuthEmail } from '@/lib/auth/callback';
import type { NextRequest } from 'next/server';

export function GET(request: NextRequest) {
  return continueFromAuthEmail(request, '/acct/reset-password', '/acct/forgot-password?link=expired');
}
