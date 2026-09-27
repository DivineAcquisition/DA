import { NextResponse, type NextRequest } from 'next/server';
import { clientFromHeaders } from '@/lib/workspace/agreement-page';
import { saveOnboardingStep } from '@/lib/workspace/onboarding';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

/** Save one step's answer. The database validates it and decides what is stored. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: { step?: unknown; input?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400, headers: NO_STORE });
  }
  if (typeof body.step !== 'string' || !body.input || typeof body.input !== 'object') {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400, headers: NO_STORE });
  }

  const result = await saveOnboardingStep(
    token,
    body.step,
    body.input as Record<string, unknown>,
    clientFromHeaders(request.headers),
  );
  if (!result) {
    // Never report a save that did not happen.
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
  return NextResponse.json(result, { headers: NO_STORE });
}
