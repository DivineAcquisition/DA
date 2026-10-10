import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { saveAcademySettings } from '@/lib/academy/adminActions';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input } from '../components/ui';
import { StudioHeader, studioLink } from './Studio';

type Lesson = {
  id: string;
  code: string;
  title: string;
  order: number;
  status: string;
  version: number;
  archived: boolean;
  video: boolean;
  document: boolean;
  watch_percent: number;
};
type Module = { id: string; program: string; order: number; title: string; lessons: Lesson[] };
type Catalog = { settings: { default_watch_percent: number; reading_words_per_minute: number; min_reading_seconds: number; document_link_seconds: number }; modules: Module[] };

export const metadata = { title: 'Academy lessons' };

export default async function AcademyAdminPage() {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const supabase = await createClient();
  const { data } = await controlRpc<Catalog>(supabase, 'academy_admin_catalog');
  const modules = data?.modules ?? [];
  const settings = data?.settings;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <StudioHeader
        title="Lessons"
        lede="Add a lesson to a module, write it, then set it live when trainees should see it."
      >
        <Link href="/workspace/academy/questions" className={studioLink}>Questions</Link>
        <Link href="/workspace/academy/quizzes" className={studioLink}>Quizzes</Link>
        <Link href="/workspace/academy/simulations" className={studioLink}>Simulations</Link>
        <Link href="/workspace/academy/import" className={studioLink}>Import</Link>
        <a href="/workspace/academy/template" className={studioLink}>Blank manifest</a>
        <a href="/workspace/academy/export" className={studioLink}>Export</a>
      </StudioHeader>

      {settings ? (
        <form action={saveAcademySettings} className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-4">
          <Field label="Default watch %">
            <Input name="watch" type="number" min={1} max={100} defaultValue={settings.default_watch_percent} />
          </Field>
          <Field label="Reading words / minute">
            <Input name="wpm" type="number" min={40} max={400} defaultValue={settings.reading_words_per_minute} />
          </Field>
          <Field label="Minimum reading seconds">
            <Input name="minimum" type="number" min={0} max={600} defaultValue={settings.min_reading_seconds} />
          </Field>
          <Field label="Document link seconds">
            <Input name="link" type="number" min={30} max={900} defaultValue={settings.document_link_seconds} />
          </Field>
          <Button type="submit" className="sm:col-span-4 sm:w-fit">
            Save learner settings
          </Button>
        </form>
      ) : null}

      {modules.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-lg font-semibold text-white">No modules yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            Lessons belong to a module. Once a program has modules, each one gets an Add lesson button.
          </p>
        </section>
      ) : null}

      {modules.map((module) => (
        <section key={module.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{module.program}</p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                {module.order}. {module.title}
              </h2>
            </div>
            <Link
              href={`/workspace/academy/lessons/new?module=${module.id}`}
              className="inline-flex min-h-11 items-center rounded-full bg-brand-500 px-4 text-sm font-semibold text-ink-950 hover:bg-brand-400"
            >
              Add lesson
            </Link>
          </div>
          {module.lessons.length === 0 ? (
            <p className="px-4 py-6 text-sm text-neutral-500 sm:px-5">No lessons in this module yet.</p>
          ) : (
            <ul>
              {module.lessons.map((lesson) => (
                <li key={lesson.id} className="border-t border-white/5 first:border-t-0">
                  <Link
                    href={`/workspace/academy/lessons/${lesson.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.03] sm:px-5"
                  >
                    <span>
                      <span className="block font-medium text-white">{lesson.title}</span>
                      <span className="mt-0.5 block font-mono text-xs text-neutral-500">
                        {lesson.code}
                        {lesson.video ? ' · video' : ''}
                        {lesson.document ? ' · document' : ''}
                        {lesson.archived ? ' · archived' : ''}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs">
                      <span className="text-neutral-500">v{lesson.version}</span>
                      <span
                        className={`rounded-full px-2.5 py-1 font-semibold capitalize ${
                          lesson.status === 'live'
                            ? 'bg-brand-500/15 text-brand-200'
                            : lesson.status === 'ready'
                              ? 'bg-amber-400/10 text-amber-200'
                              : 'bg-white/5 text-neutral-400'
                        }`}
                      >
                        {lesson.status}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
