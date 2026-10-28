import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { saveConcept, setQuestionActive } from '@/lib/academy/quizAdmin';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input, Select } from '../../components/ui';
import { StudioHeader, studioLink } from '../Studio';

type Bank = {
  concepts: { id: string; module_id: string; name: string; lesson_title: string | null }[];
  questions: {
    id: string;
    module_order: number;
    prompt: string;
    question_type: string;
    concept_tag: string | null;
    difficulty: string;
    active: boolean;
    used: boolean;
  }[];
  pools: { module_id: string; order: number; title: string; active_count: number; health: string }[];
};

type Catalog = { modules: { id: string; order: number; title: string; lessons: { id: string; title: string }[] }[] };

export const metadata = { title: 'Question bank' };

export default async function QuestionsPage() {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const supabase = await createClient();
  const [{ data }, { data: catalog }] = await Promise.all([
    controlRpc<Bank>(supabase, 'academy_admin_questions', { p_module_id: null }),
    controlRpc<Catalog>(supabase, 'academy_admin_catalog'),
  ]);
  const bank = data ?? { concepts: [], questions: [], pools: [] };
  const modules = catalog?.modules ?? [];
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <StudioHeader title="Question bank" lede="A pool under 15 active questions will repeat itself.">
        <Link href="/workspace/academy/questions/new" className="inline-flex min-h-11 items-center rounded-full bg-brand-500 px-4 text-sm font-semibold text-ink-950 hover:bg-brand-400">Add question</Link>
        <Link href="/workspace/academy/questions/import" className={studioLink}>Import</Link>
        <a href="/workspace/academy/questions/template" className={studioLink} download>Blank file</a>
        <a href="/workspace/academy/questions/export" className={studioLink} download>Export</a>
        <Link href="/workspace/academy/questions/stats" className={studioLink}>Statistics</Link>
      </StudioHeader>
      <div className="grid gap-2 sm:grid-cols-2">
        {bank.pools.map((pool) => (
          <p key={pool.module_id} className="rounded-2xl border border-white/10 px-3 py-2 text-sm text-neutral-200">
            Module {pool.order}. {pool.title}: {pool.active_count} active
            {pool.health === 'thin' ? <span className="ml-2 text-amber-200">Thin pool</span> : null}
          </p>
        ))}
      </div>
      <form action={saveConcept} className="grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-3">
        <Field label="Module">
          <Select name="module_id" defaultValue={modules[0]?.id}>
            {modules.map((module) => (
              <option key={module.id} value={module.id}>{module.order}. {module.title}</option>
            ))}
          </Select>
        </Field>
        <Field label="Concept tag">
          <Input name="name" required />
        </Field>
        <Field label="Lesson">
          <Select name="lesson_id">
            {modules.flatMap((module) => module.lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>{module.order}. {lesson.title}</option>
            )))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary" className="sm:col-span-3 sm:w-fit">Add concept tag</Button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[40rem] text-left text-sm text-neutral-200">
          <thead className="text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Question</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Concept</th>
              <th className="px-3 py-2">Difficulty</th>
              <th className="px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {bank.questions.map((question) => (
              <tr key={question.id} className="border-t border-white/5">
                <td className="px-3 py-2">
                  <Link href={`/workspace/academy/questions/${question.id}`} className="text-white">{question.prompt}</Link>
                  <p className="text-xs text-neutral-500">Module {question.module_order}</p>
                </td>
                <td className="px-3 py-2">{question.question_type === 'scenario' ? 'Scenario' : 'Multiple choice'}</td>
                <td className="px-3 py-2">{question.concept_tag}</td>
                <td className="px-3 py-2 capitalize">{question.difficulty}</td>
                <td className="px-3 py-2">
                  <form action={setQuestionActive}>
                    <input type="hidden" name="id" value={question.id} />
                    <input type="hidden" name="active" value={question.active ? 'false' : 'true'} />
                    <button type="submit" className="text-sm text-brand-200">
                      {question.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </form>
                  {question.used ? <p className="text-xs text-neutral-500">Used in an attempt</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
