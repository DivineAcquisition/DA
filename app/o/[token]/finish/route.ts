import { NextResponse, type NextRequest } from 'next/server';
import { clientFromHeaders } from '@/lib/workspace/agreement-page';
import { finishOnboarding } from '@/lib/workspace/onboarding';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

/**
 * Finish onboarding. Required steps are checked by da_onboarding_finish(), so
 * calling this directly with steps missing is refused the same way the page
 * is. Calling it twice returns the first completion.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await finishOnboarding(token, clientFromHeaders(request.headers));
  if (!result) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
  return NextResponse.json(result, { headers: NO_STORE });
}
