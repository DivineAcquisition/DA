import { continueFromAuthEmail } from '@/lib/auth/callback';
import type { NextRequest } from 'next/server';

export function GET(request: NextRequest) {
  return continueFromAuthEmail(request, '/ad/reset-password', '/ad/forgot-password?link=expired');
}
