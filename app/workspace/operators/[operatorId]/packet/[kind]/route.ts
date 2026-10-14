import { NextResponse } from 'next/server';
import { requireAdmin, serviceRoleClient } from '@/lib/workspace/db';

export const dynamic = 'force-dynamic';

/** Streams the filed onboarding PDF or the signed agreement. Admin only. */
export async function GET(_request: Request, context: { params: Promise<{ operatorId: string; kind: string }> }) {
  const session = await requireAdmin();
  if (!session) return new NextResponse('Admin access is required.', { status: 403 });
  const { operatorId, kind } = await context.params;
  if (kind !== 'onboarding' && kind !== 'agreement') return new NextResponse('Not found.', { status: 404 });

  const client = serviceRoleClient();
  if (!client) return new NextResponse('Storage is not configured.', { status: 503 });
  const column = kind === 'onboarding' ? 'onboarding_pdf_b64' : 'agreement_pdf_b64';
  const { data } = await client
    .from('operator_packet')
    .select(`${column}, agreement_filename`)
    .eq('operator_id', operatorId)
    .maybeSingle();
  const row = data as { onboarding_pdf_b64?: string | null; agreement_pdf_b64?: string | null; agreement_filename?: string | null } | null;
  const encoded = kind === 'onboarding' ? row?.onboarding_pdf_b64 : row?.agreement_pdf_b64;
  if (!encoded) return new NextResponse('That file has not been filed yet.', { status: 404 });

  const filename = kind === 'onboarding' ? 'onboarding.pdf' : row?.agreement_filename || 'signed-agreement.pdf';
  return new NextResponse(Buffer.from(encoded, 'base64'), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
