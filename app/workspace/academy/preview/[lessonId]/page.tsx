import { Plus_Jakarta_Sans } from 'next/font/google';
import { notFound, redirect } from 'next/navigation';
import LessonPlayer from '@/app/academy/components/LessonPlayer';
import '@/app/academy/academy.css';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { lessonView } from '@/lib/academy/lessonView';
import { createClient } from '@/lib/supabase/server';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-academy-display',
  display: 'swap',
});

export default async function PreviewLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const { lessonId } = await params;
  const supabase = await createClient();
  const { data } = await controlRpc<Record<string, unknown>>(supabase, 'academy_admin_lesson', { p_lesson_id: lessonId });
  if (!data || data.state === 'missing') notFound();
  const video = data.video as { provider?: string; provider_id?: string; duration?: number | null } | null;
  const document = data.document as { file_name?: string } | null;
  const lesson = lessonView(
    {
      id: String(data.id),
      code: String(data.code),
      title: String(data.title),
      body: String(data.body ?? ''),
      position: Number(data.position ?? data.order ?? 1),
      total: Number(data.total ?? 1),
      module_id: String(data.module_id),
      module_title: String(data.module_title ?? ''),
      module_order: Number(data.module_order ?? 0),
      watch_percent: Number(data.watch_percent ?? 90),
      reading_seconds: Number(data.reading_seconds ?? 0),
      video: video?.provider_id ? { provider: video.provider, provider_id: video.provider_id, duration: video.duration } : null,
      document: Boolean(document),
      document_name: document?.file_name ?? null,
      missing: [],
      complete: false,
    },
    true,
  );
  if (!lesson) notFound();
  return (
    <div className={`${plusJakarta.variable} academy mx-auto max-w-xl bg-ink-950 px-4 py-8 text-white`}>
      <LessonPlayer lesson={lesson} />
    </div>
  );
}
