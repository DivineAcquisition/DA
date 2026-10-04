import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { createClient } from '@/lib/supabase/server';

type QuizRow = {
  id: string;
  module_order: number;
  module_title: string;
  program: string;
  kind: string;
  questions_per_attempt: number;
  pass_mark: number;
  pass_mark_unit: string;
  max_attempts: number;
  lockout_minutes: number;
  active: boolean;
  servable: boolean;
  pool_message: string | null;
};

export const metadata = { title: 'Academy quizzes' };

export default async function QuizzesPage() {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const supabase = await createClient();
  const { data } = await controlRpc<QuizRow[]>(supabase, 'academy_admin_quizzes');
  const quizzes = data ?? [];
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Quiz settings</h1>
          <p className="mt-1 text-sm text-neutral-400">Changes apply to future attempts only.</p>
        </div>
        <Link href="/workspace/academy/questions" className="text-sm text-brand-200">
          Question bank
        </Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[40rem] text-left text-sm text-neutral-200">
          <thead className="text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Quiz</th>
              <th className="px-3 py-2">Attempt</th>
              <th className="px-3 py-2">Pass</th>
              <th className="px-3 py-2">Lockout</th>
              <th className="px-3 py-2">Live</th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((quiz) => (
              <tr key={quiz.id} className="border-t border-white/5">
                <td className="px-3 py-2">
                  <Link href={`/workspace/academy/quizzes/${quiz.id}`} className="text-white">
                    {quiz.module_order}. {quiz.module_title}
                  </Link>
                  <p className="text-xs text-neutral-500">{quiz.program}</p>
                  {quiz.pool_message ? <p className="mt-1 text-xs text-amber-200">{quiz.pool_message}</p> : null}
                </td>
                <td className="px-3 py-2">{quiz.questions_per_attempt} questions, {quiz.max_attempts} attempts</td>
                <td className="px-3 py-2">{quiz.pass_mark_unit === 'percent' ? `${quiz.pass_mark}%` : `${quiz.pass_mark} correct`}</td>
                <td className="px-3 py-2">{quiz.lockout_minutes} min</td>
                <td className="px-3 py-2">{quiz.servable ? 'Yes' : quiz.active ? 'Pool short' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
