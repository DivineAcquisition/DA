import { NextResponse } from 'next/server';
import { publicDaRpc } from '@/lib/workspace/resolve-signing';
import { streamSignedCopy, type SignedCopy } from '@/lib/workspace/signed-copy';

export const dynamic = 'force-dynamic';

/**
 * The signed copy, streamed through this origin so the DocuSeal file URL never
 * reaches the browser and mobile viewers render it. Only a completed
 * agreement's token gets anything.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const copy = await publicDaRpc<SignedCopy>('da_agreement_signed_copy', { p_token: token });
  if (!copy) {
    return NextResponse.json({ error: 'This document is not available.' }, { status: 404 });
  }
  return streamSignedCopy(copy, 'attachment');
}
