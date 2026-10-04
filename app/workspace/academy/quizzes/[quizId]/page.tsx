import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { saveQuizSettings, satisfyGate } from '@/lib/academy/quizAdmin';
import { createClient } from '@/lib/supabase/server';
import GateForm from './GateForm';
import { Button, Field, Input, Select } from '../../../components/ui';

type QuizRow = {
  id: string;
  module_title: string;
  module_order: number;
  kind: string;
  questions_per_attempt: number;
  pass_mark: number;
  pass_mark_unit: string;
  max_attempts: number;
  lockout_minutes: number;
  shuffle_answers: boolean;
  active: boolean;
  servable: boolean;
  time_limit_seconds: number | null;
  abandoned_minutes: number;
  min_seconds_per_question: number;
  pool_message: string | null;
  gates: { id: string; key: string; label: string }[];
};

export default async function QuizSettingsPage({ params }: { params: Promise<{ quizId: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const { quizId } = await params;
  const supabase = await createClient();
  const { data } = await controlRpc<QuizRow[]>(supabase, 'academy_admin_quizzes');
  const quiz = (data ?? []).find((item) => item.id === quizId);
  if (!quiz) notFound();
  const parts = (quiz.gates ?? []).filter((gate) => gate.key !== 'quiz' && gate.key !== 'agreement');
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <Link href="/workspace/academy/quizzes" className="text-sm text-neutral-400">
          All quizzes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {quiz.module_order}. {quiz.module_title}
        </h1>
        {quiz.pool_message ? <p className="mt-2 text-sm text-amber-200">{quiz.pool_message}</p> : null}
        {quiz.servable ? (
          <Link href={`/workspace/academy/quizzes/${quiz.id}/preview`} className="mt-3 inline-flex text-sm text-brand-200">
            Preview as a trainee
          </Link>
        ) : null}
      </div>
      <form action={saveQuizSettings} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={quiz.id} />
        <Field label="Questions per attempt">
          <Input name="questions" type="number" min={1} defaultValue={quiz.questions_per_attempt} required />
        </Field>
        <Field label="Pass mark">
          <Input name="pass_mark" type="number" min={1} defaultValue={quiz.pass_mark} required />
        </Field>
        <Field label="Pass mark unit">
          <Select name="pass_unit" defaultValue={quiz.pass_mark_unit}>
            <option value="correct">Correct answers</option>
            <option value="percent">Percent</option>
          </Select>
        </Field>
        <Field label="Maximum attempts">
          <Input name="max_attempts" type="number" min={1} defaultValue={quiz.max_attempts} required />
        </Field>
        <Field label="Lockout minutes">
          <Input name="lockout" type="number" min={0} defaultValue={quiz.lockout_minutes} required />
        </Field>
        <Field label="Abandoned after minutes">
          <Input name="abandoned" type="number" min={5} defaultValue={quiz.abandoned_minutes} required />
        </Field>
        <Field label="Time limit minutes" hint="Leave blank for no limit.">
          <Input name="time_limit" type="number" min={1} defaultValue={quiz.time_limit_seconds ? quiz.time_limit_seconds / 60 : ''} />
        </Field>
        <Field label="Minimum seconds per question" hint="Faster attempts are flagged for admins.">
          <Input name="minimum" type="number" min={0} defaultValue={quiz.min_seconds_per_question} required />
        </Field>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" name="shuffle" defaultChecked={quiz.shuffle_answers} />
          Shuffle questions and options
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" name="active" defaultChecked={quiz.active && quiz.servable} />
          Live for trainees
        </label>
        <Button type="submit" className="sm:col-span-2 sm:w-fit">
          Save settings
        </Button>
      </form>
      {parts.length > 0 ? (
        <GateForm parts={parts} />
      ) : null}
    </div>
  );
}
