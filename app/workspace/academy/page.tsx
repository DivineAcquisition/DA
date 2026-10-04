import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { saveAcademySettings } from '@/lib/academy/adminActions';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input } from '../components/ui';

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
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Academy lessons</h1>
          <p className="mt-1 text-sm text-neutral-400">Load videos, documents, and written lessons by lesson ID.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/workspace/academy/quizzes" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">
            Quizzes
          </Link>
          <Link href="/workspace/academy/questions" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">
            Questions
          </Link>
          <Link href="/workspace/academy/import" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">
            Import
          </Link>
          <a href="/workspace/academy/template" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">
            Blank manifest
          </a>
          <a href="/workspace/academy/export" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">
            Export
          </a>
        </div>
      </div>

      {settings ? (
        <form action={saveAcademySettings} className="grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-4">
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

      {modules.map((module) => (
        <section key={module.id} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">
              {module.order}. {module.title}
              <span className="ml-2 text-sm font-normal text-neutral-500">{module.program}</span>
            </h2>
            <Link href={`/workspace/academy/lessons/new?module=${module.id}`} className="text-sm text-brand-200">
              Add lesson
            </Link>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[40rem] text-left text-sm text-neutral-200">
              <thead className="text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Video</th>
                  <th className="px-3 py-2">Document</th>
                </tr>
              </thead>
              <tbody>
                {module.lessons.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-neutral-500">
                      No lessons yet.
                    </td>
                  </tr>
                ) : (
                  module.lessons.map((lesson) => (
                    <tr key={lesson.id} className="border-t border-white/5">
                      <td className="px-3 py-2 font-mono text-xs">{lesson.code}</td>
                      <td className="px-3 py-2">
                        <Link href={`/workspace/academy/lessons/${lesson.id}`} className="text-white">
                          {lesson.title}
                        </Link>
                        {lesson.archived ? <span className="ml-2 text-xs text-neutral-500">Archived</span> : null}
                      </td>
                      <td className="px-3 py-2 capitalize">{lesson.status}</td>
                      <td className="px-3 py-2">{lesson.version}</td>
                      <td className="px-3 py-2">{lesson.video ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">{lesson.document ? 'Yes' : 'No'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
