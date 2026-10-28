import { NextResponse } from 'next/server';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { manifestCsv } from '@/lib/academy/manifest';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const session = await academyAdminSession();
  if (!session) return new NextResponse('Academy admin access is required.', { status: 403 });
  const supabase = await createClient();
  const { data } = await controlRpc<
    { lesson_id: string; title: string; order: number; video_link: string; document_file: string; duration: string; watch_percent: number; written: string; status: string }[]
  >(supabase, 'academy_export_lessons');
  const rows = (data ?? []).map((row) => ({
    'Lesson ID': row.lesson_id,
    Title: row.title,
    Order: String(row.order),
    'Video link': row.video_link,
    'Companion document file name': row.document_file,
    Duration: row.duration,
    'Required watch percentage': String(row.watch_percent),
    'Written lesson text or a file name for it': row.written,
    Status: row.status,
    Completion: '',
  }));
  return new NextResponse(manifestCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="academy-lessons.csv"',
    },
  });
}
