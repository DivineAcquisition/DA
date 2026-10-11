import { NextResponse, type NextRequest } from 'next/server';
import { clientFromHeaders } from '@/lib/workspace/agreement-page';
import { applyAgreementSignature } from '@/lib/workspace/sign-agreement';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

function json(body: { ok: boolean; error?: string }, status: number) {
  return NextResponse.json(body, { status, headers: HEADERS });
}

/**
 * Places the signature drawn on this page onto each signature line of the
 * DocuSeal agreement. The browser never talks to DocuSeal.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > 800_000) {
    return json({ ok: false, error: 'That signature image is too large.' }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Draw or type your signature before you submit.' }, 400);
  }

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const signature = typeof record.signature === 'string' ? record.signature : '';
  const initials = typeof record.initials === 'string' ? record.initials : null;
  const consentIds = Array.isArray(record.consentIds)
    ? record.consentIds.filter((id): id is string => typeof id === 'string').slice(0, 20)
    : [];

  const result = await applyAgreementSignature({
    token,
    client: clientFromHeaders(request.headers),
    signature,
    initials,
    consentIds,
  });

  if (!result.ok) return json({ ok: false, error: result.error }, result.status);
  return json({ ok: true }, 200);
}
