import { Plus_Jakarta_Sans } from 'next/font/google';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import Chrome from '@/app/academy/components/Chrome';
import LessonPlayer from '@/app/academy/components/LessonPlayer';
import LessonQuiz, { type LessonQuizPack } from '@/app/academy/components/LessonQuiz';
import '@/app/academy/academy.css';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { lessonView, studentStartGaps } from '@/lib/academy/lessonView';
import { createClient } from '@/lib/supabase/server';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-academy-display',
  display: 'swap',
});

type Catalog = {
  modules: { id: string; lessons: { id: string; order: number; archived: boolean }[] }[];
};

export default async function PreviewLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const { lessonId } = await params;
  const supabase = await createClient();
  const { data } = await controlRpc<Record<string, unknown>>(supabase, 'academy_admin_lesson', { p_lesson_id: lessonId });
  if (!data || data.state === 'missing') notFound();
  const video = data.video as { provider?: string; provider_id?: string; url?: string | null; duration?: number | null } | null;
  const document = data.document as { file_name?: string } | null;
  const { data: catalog } = await controlRpc<Catalog>(supabase, 'academy_admin_catalog');
  const siblings = (catalog?.modules.find((module) => module.id === data.module_id)?.lessons ?? [])
    .filter((item) => !item.archived)
    .sort((a, b) => a.order - b.order);
  const index = siblings.findIndex((item) => item.id === String(data.id));
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
      video: video?.provider ? { provider: video.provider, provider_id: video.provider_id, url: video.url ?? null, duration: video.duration } : null,
      document: Boolean(document),
      document_name: document?.file_name ?? null,
      missing: [],
      complete: false,
      prev_id: index > 0 ? siblings[index - 1]?.id ?? null : null,
      next_id: index >= 0 ? siblings[index + 1]?.id ?? null : null,
      next_open: true,
    },
    true,
  );
  if (!lesson) notFound();
  const live = data.status === 'live';
  const { data: pack } = await controlRpc<LessonQuizPack>(supabase, 'academy_lesson_quiz', { p_lesson_id: lessonId });
  return (
    <div className={`${plusJakarta.variable} academy min-h-dvh text-white`}>
      <div className="border-b border-white/10 bg-[#07070b]/90">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm text-neutral-200">
            Student view of {lesson.code}. Progress is not recorded.
            {live ? '' : ' Trainees see this only after the status is Live.'}
          </p>
          <Link href={`/workspace/academy/lessons/${lesson.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#937DFF]">
            Back to editor
          </Link>
        </div>
      </div>
      <Chrome nav signedIn preview>
        <div className="space-y-8">
          <LessonPlayer lesson={{ ...lesson, missing: studentStartGaps(lesson) }} />
          <LessonQuiz moduleId={String(data.module_id)} pack={pack ?? {}} scoredOpen={false} />
        </div>
      </Chrome>
    </div>
  );
}
