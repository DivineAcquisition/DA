import { NextResponse } from 'next/server';
import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { streamSignedCopy, type SignedCopy } from '@/lib/workspace/signed-copy';

export const dynamic = 'force-dynamic';

/**
 * A VA's own signed agreement. portal_agreement_copy only answers for the
 * signed-in VA's completed agreements (and refuses a viewer without payroll
 * access, since the agreement carries pay terms).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ agreementId: string }> }) {
  const { agreementId } = await params;
  const supabase = await createClient();
  const { data, error } = await controlRpc<SignedCopy>(supabase, 'portal_agreement_copy', { p_agreement_id: agreementId });
  if (error || !data) {
    return NextResponse.json({ error: 'This document is not available.' }, { status: 404 });
  }
  return streamSignedCopy(data, 'inline');
}
