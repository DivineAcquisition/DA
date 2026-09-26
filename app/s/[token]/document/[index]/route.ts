import { NextResponse } from 'next/server';
import { loadSigningPage } from '@/lib/workspace/signing';

export const dynamic = 'force-dynamic';

/**
 * Streams an agreement PDF through this origin.
 *
 * Mobile Safari and several PDF viewers will not paint a cross-origin DocuSeal
 * file inside an iframe, which reads to the signer as "the agreement won't
 * load". NovaraCleaning's signing page hit the same wall and fixed it the same
 * way. The signing token is the credential: no valid token, no document.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; index: string }> },
) {
  const { token, index } = await params;
  const page = await loadSigningPage(token);
  const position = Number(index);
  const source = page && Number.isInteger(position) ? page.sourceDocuments[position] : undefined;
  if (!source) {
    return NextResponse.json({ error: 'This document is not available.' }, { status: 404 });
  }

  const upstream = await fetch(source.url, { cache: 'no-store' });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Could not load the agreement (${upstream.status}).` },
      { status: 502 },
    );
  }

  const filename = `${source.name.replace(/[^\w.\- ]+/g, '').trim() || 'Agreement'}.pdf`;
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      // Per-signer document behind a credential: never cached by a shared cache.
      'Cache-Control': 'private, no-store',
    },
  });
}
