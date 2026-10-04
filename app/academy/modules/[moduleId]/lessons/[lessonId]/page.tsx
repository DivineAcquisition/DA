import Link from 'next/link';
import LessonPlayer from '@/app/academy/components/LessonPlayer';
import { controlRpc } from '@/lib/ad/rpc';
import { lessonView } from '@/lib/academy/lessonView';
import { academyContentOpen } from '@/lib/academy/types';
import { loadAcademyShell } from '@/lib/academy/load';
import { createClient } from '@/lib/supabase/server';

export default async function AcademyLessonPage({ params }: { params: Promise<{ moduleId: string; lessonId: string }> }) {
  const { moduleId, lessonId } = await params;
  const loaded = await loadAcademyShell();
  if (!loaded.ok || !academyContentOpen(loaded.shell.state)) return null;
  const supabase = await createClient();
  const { data } = await controlRpc<Record<string, unknown>>(supabase, 'academy_lesson_page', { p_lesson_id: lessonId });
  if (!data || data.state !== 'ok') {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h1 className="text-2xl font-semibold">This lesson is locked.</h1>
        <p className="mt-3 text-sm text-neutral-300">Finish the lesson before it, or wait until this module is published.</p>
        <Link href={`/academy/modules/${moduleId}`} className="mt-6 inline-flex min-h-11 items-center text-sm text-[#937DFF]">
          Back to the module
        </Link>
      </section>
    );
  }
  const lesson = lessonView(data);
  if (!lesson) return null;
  await controlRpc(supabase, 'academy_record_lesson_open', { p_lesson_id: lessonId });
  return <LessonPlayer lesson={lesson} />;
}
