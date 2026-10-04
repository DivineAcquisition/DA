import { notFound, redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { createClient } from '@/lib/supabase/server';
import LessonForm from '../LessonForm';

type AdminLesson = {
  state?: string;
  id: string;
  module_id: string;
  code: string;
  title: string;
  body: string;
  order: number;
  status: string;
  watch_percent: number;
  completions: number;
  document?: { file_name?: string } | null;
  video?: { url?: string; provider?: string; provider_id?: string; duration?: number | null } | null;
};

export default async function EditLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const { lessonId } = await params;
  const supabase = await createClient();
  const { data } = await controlRpc<AdminLesson>(supabase, 'academy_admin_lesson', { p_lesson_id: lessonId });
  if (!data || data.state === 'missing') notFound();
  const { data: catalog } = await controlRpc<{ modules: { id: string; order: number; title: string; program: string }[] }>(
    supabase,
    'academy_admin_catalog',
  );
  const videoUrl =
    data.video?.url ||
    (data.video?.provider === 'vimeo' && data.video.provider_id ? `https://vimeo.com/${data.video.provider_id}` : '');
  return (
    <LessonForm
      lesson={{
        id: data.id,
        moduleId: data.module_id,
        code: data.code,
        title: data.title,
        order: data.order,
        status: data.status,
        watch: data.watch_percent,
        body: data.body,
        videoUrl,
        duration: data.video?.duration ? String(data.video.duration) : '',
        documentName: data.document?.file_name ?? null,
        completions: data.completions,
        modules: (catalog?.modules ?? []).map((module) => ({
          id: module.id,
          label: `${module.program} · ${module.order}. ${module.title}`,
        })),
      }}
    />
  );
}
