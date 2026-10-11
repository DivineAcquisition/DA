import { NextResponse, type NextRequest } from 'next/server';
import { clientFromHeaders } from '@/lib/workspace/agreement-page';
import { streamAgreementPreview } from '@/lib/workspace/agreement-preview';

export const dynamic = 'force-dynamic';

/** Same-origin agreement PDF for the in-page viewer. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return await streamAgreementPreview(token, clientFromHeaders(request.headers));
  } catch (error) {
    console.error('[agreement-preview]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'The agreement could not be loaded.' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
