import { NextResponse } from 'next/server';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/workspace/db';

export async function GET(_request: Request, context: { params: Promise<{ lessonId: string }> }) {
  const session = await academyAdminSession();
  if (!session) return new NextResponse('Academy admin access is required.', { status: 403 });
  const { lessonId } = await context.params;
  const supabase = await createClient();
  const { data } = await controlRpc<{ ok?: boolean; storage_path?: string; file_name?: string }>(
    supabase,
    'academy_admin_document',
    { p_lesson_id: lessonId },
  );
  if (!data?.ok || !data.storage_path) return new NextResponse('No document.', { status: 404 });
  const service = serviceClient();
  if (!service) return new NextResponse('Storage is not configured.', { status: 503 });
  const downloaded = await service.storage.from('academy-documents').download(data.storage_path);
  if (!downloaded.data) return new NextResponse('Missing file.', { status: 404 });
  const bytes = await downloaded.data.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `inline; filename="${(data.file_name || 'document').replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
