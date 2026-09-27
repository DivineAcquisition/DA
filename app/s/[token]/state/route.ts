import { NextResponse, type NextRequest } from 'next/server';
import { clientFromHeaders, loadAgreementPage } from '@/lib/workspace/agreement-page';

export const dynamic = 'force-dynamic';

/**
 * Polled by the page after the embed reports it is done. The browser's
 * "completed" event is not the record; the DocuSeal webhook moving the
 * agreement to completed is. While it is still open this answers only
 * {"state":"open"}, never the signing details again.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await loadAgreementPage(token, clientFromHeaders(request.headers));
  const body = page.state === 'open' ? { state: 'open' } : page;
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
