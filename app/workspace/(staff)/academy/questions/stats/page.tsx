import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { createClient } from '@/lib/supabase/server';

type Stats = {
  questions: { id: string; prompt: string; concept: string | null; module_order: number; appearances: number; misses: number }[];
  concepts: { tag: string; misses: number }[];
  fast: { attempt_id: string; time_taken_seconds: number; email: string | null; module_order: number; at: string }[];
};

export default async function QuestionStatsPage() {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const supabase = await createClient();
  const { data } = await controlRpc<Stats>(supabase, 'academy_question_stats');
  const stats = data ?? { questions: [], concepts: [], fast: [] };
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <Link href="/workspace/academy/questions" className="text-sm text-neutral-400">Question bank</Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Question statistics</h1>
      </div>
      <section>
        <h2 className="text-lg font-semibold text-white">Missed concepts</h2>
        <ul className="mt-3 space-y-1 text-sm text-neutral-200">
          {stats.concepts.length === 0 ? <li className="text-neutral-500">No finished attempts yet.</li> : null}
          {stats.concepts.map((concept) => (
            <li key={concept.tag}>{concept.tag}: missed {concept.misses} times</li>
          ))}
        </ul>
      </section>
      <section className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[36rem] text-left text-sm text-neutral-200">
          <thead className="text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Question</th>
              <th className="px-3 py-2">Concept</th>
              <th className="px-3 py-2">Shown</th>
              <th className="px-3 py-2">Missed</th>
            </tr>
          </thead>
          <tbody>
            {stats.questions.map((question) => (
              <tr key={question.id} className="border-t border-white/5">
                <td className="px-3 py-2">{question.prompt}</td>
                <td className="px-3 py-2">{question.concept}</td>
                <td className="px-3 py-2">{question.appearances}</td>
                <td className="px-3 py-2">{question.misses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">Fast attempts</h2>
        <ul className="mt-3 space-y-1 text-sm text-neutral-200">
          {stats.fast.length === 0 ? <li className="text-neutral-500">None flagged.</li> : null}
          {stats.fast.map((flag) => (
            <li key={flag.attempt_id}>
              Module {flag.module_order} · {flag.email} · {flag.time_taken_seconds}s
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
