import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { createClient } from '@/lib/supabase/server';
import LessonForm from '../LessonForm';

export default async function NewLessonPage({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const { module: moduleId } = await searchParams;
  const supabase = await createClient();
  const { data } = await controlRpc<{
    settings: { default_watch_percent: number };
    modules: { id: string; order: number; title: string; program: string; lessons: { order: number }[] }[];
  }>(supabase, 'academy_admin_catalog');
  const modules = data?.modules ?? [];
  const selected = modules.find((module) => module.id === moduleId) ?? modules[0];
  if (!selected) redirect('/workspace/academy');
  const nextOrder = Math.max(0, ...selected.lessons.map((lesson) => lesson.order)) + 1;
  const code = `M${String(selected.order).padStart(2, '0')}-L${String(nextOrder).padStart(2, '0')}`;
  return (
    <LessonForm
      lesson={{
        moduleId: selected.id,
        code,
        title: '',
        order: nextOrder,
        status: 'draft',
        watch: data?.settings.default_watch_percent ?? 90,
        body: '',
        videoUrl: '',
        duration: '',
        documentName: null,
        completions: 0,
        modules: modules.map((module) => ({ id: module.id, label: `${module.program} · ${module.order}. ${module.title}` })),
      }}
    />
  );
}
