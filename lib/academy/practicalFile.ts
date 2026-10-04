import { NextResponse } from 'next/server';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/workspace/db';

function contentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

export async function practicalFileResponse(evidenceId: string) {
  const supabase = await createClient();
  const { data, error } = await controlRpc<string>(supabase, 'academy_practical_file', { p_evidence: evidenceId });
  if (error || !data) return new NextResponse(error ? readable(error) : 'This file is closed.', { status: 404 });
  const service = serviceClient();
  if (!service) return new NextResponse('Storage is not configured.', { status: 503 });
  const downloaded = await service.storage.from('academy-documents').download(data);
  if (downloaded.error || !downloaded.data) return new NextResponse('This screenshot is missing.', { status: 404 });
  const bytes = await downloaded.data.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': contentType(data),
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
