import { NextResponse } from 'next/server';
import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/workspace/db';

function contentType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'txt' || ext === 'md') return 'text/plain; charset=utf-8';
  if (ext === 'png') return 'image/png';
  return 'application/octet-stream';
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const supabase = await createClient();
  const { data } = await controlRpc<{ ok?: boolean; storage_path?: string; file_name?: string }>(
    supabase,
    'academy_claim_document',
    { p_token: token },
  );
  if (!data?.ok || !data.storage_path) {
    return new NextResponse('This document link is closed.', { status: 404 });
  }
  const service = serviceClient();
  if (!service) return new NextResponse('Storage is not configured.', { status: 503 });
  const downloaded = await service.storage.from('academy-documents').download(data.storage_path);
  if (downloaded.error || !downloaded.data) return new NextResponse('This document is missing.', { status: 404 });
  const bytes = await downloaded.data.arrayBuffer();
  const fileName = data.file_name || 'document';
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': contentType(fileName),
      'Content-Disposition': `inline; filename="${fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
