import Link from 'next/link';
import { controlRpc } from '@/lib/ad/rpc';
import { moduleStatusLabel } from '@/lib/academy/paths';
import { loadAcademyShell } from '@/lib/academy/load';
import { academyContentOpen } from '@/lib/academy/types';
import { createClient } from '@/lib/supabase/server';

type LessonRow = { id: string; code: string; title: string; position: number; open: boolean; complete: boolean };

export default async function AcademyModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const loaded = await loadAcademyShell();
  if (!loaded.ok || !academyContentOpen(loaded.shell.state)) return null;
  const current = loaded.shell.modules.find((item) => item.id === moduleId);

  if (!current) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h1 className="text-2xl font-semibold">This module is not in your program.</h1>
        <Link href="/academy/modules" className="mt-6 inline-flex min-h-11 items-center text-sm text-[#937DFF]">
          Back to modules
        </Link>
      </section>
    );
  }

  const label = moduleStatusLabel(current.display);
  if (current.display === 'unpublished' || current.display === 'locked' || !current.openable) {
    const detail =
      current.display === 'unpublished'
        ? 'This module has no lessons yet.'
        : 'Finish the previous module before this one opens.';
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#937DFF]">{label}</p>
        <h1 className="mt-2 text-2xl font-semibold">
          {current.order}. {current.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">{detail}</p>
        <Link href="/academy/modules" className="mt-6 inline-flex min-h-11 items-center text-sm text-[#937DFF]">
          Back to modules
        </Link>
      </section>
    );
  }

  const supabase = await createClient();
  const { data } = await controlRpc<LessonRow[]>(supabase, 'academy_module_lessons', { p_module_id: moduleId });
  const lessons = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#937DFF]">{label}</p>
        <h1 className="mt-2 text-2xl font-semibold">
          {current.order}. {current.title}
        </h1>
      </div>
      <ol className="space-y-3">
        {lessons.map((lesson) => {
          const state = lesson.complete ? 'Complete' : lesson.open ? 'Available' : 'Locked';
          const inner = (
            <>
              <p className="text-base font-semibold">
                {lesson.position}. {lesson.title}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                {lesson.code} · {state}
              </p>
            </>
          );
          return (
            <li key={lesson.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              {lesson.open ? <Link href={`/academy/modules/${moduleId}/lessons/${lesson.id}`}>{inner}</Link> : inner}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
