import { NextResponse } from 'next/server';
import { storedApplication } from '@/lib/acq/application-server';
import { getSessionContext } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export function adminCanOpenPdf(userId: string | null | undefined): boolean {
  return Boolean(userId);
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const session = await getSessionContext();
  if (!adminCanOpenPdf(session?.isAdmin ? session.userId : null)) {
    return NextResponse.json({ ok: false, error: 'Sign in to open this file.' }, { status: 401 });
  }
  const { token } = await context.params;
  const record = storedApplication(token);
  const pdf = record?.delivery?.pdfBytes;
  if (!pdf) return NextResponse.json({ ok: false, error: 'That PDF is not ready.' }, { status: 404 });
  const bytes = Buffer.from(pdf, 'base64');
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${record?.delivery?.pdfName || 'application.pdf'}"`,
      'Cache-Control': 'private, max-age=60',
    },
  });
}
