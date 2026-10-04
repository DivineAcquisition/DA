import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyHoldSession } from '@/lib/academy/access';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Select } from '../../components/ui';

type HoldRow = {
  id: string;
  trainee_name: string;
  program: string;
  quiz_label: string;
  module_title: string | null;
  attempts_used: number;
  opened_at: string;
  reviewer_name: string | null;
  status: string;
  days_open: number;
  overdue: boolean;
  unassigned: boolean;
};
type Queue = {
  counts: { open: number; under_review: number; overdue: number; resolved_30: number };
  holds: HoldRow[];
  reviewers: { id: string; name: string }[];
  quizzes: { id: string; label: string }[];
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved: 'Resolved',
};

export const metadata = { title: 'Academy holds' };

export default async function HoldsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; reviewer?: string; quiz?: string; unassigned?: string; error?: string }>;
}) {
  const session = await academyHoldSession();
  if (!session) redirect('/workspace/login');
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await controlRpc<Queue>(supabase, 'academy_hold_queue', {
    p_status: params.status || null,
    p_reviewer: params.reviewer || null,
    p_quiz: params.quiz || null,
    p_unassigned: params.unassigned === '1',
  });
  const queue = data ?? { counts: { open: 0, under_review: 0, overdue: 0, resolved_30: 0 }, holds: [], reviewers: [], quizzes: [] };
  const counts = [
    ['Open', queue.counts.open],
    ['Under Review', queue.counts.under_review],
    ['Overdue', queue.counts.overdue],
    ['Resolved, 30 days', queue.counts.resolved_30],
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Holds</h1>
          <p className="mt-1 text-sm text-neutral-400">Reviews opened when a trainee uses the last quiz attempt.</p>
        </div>
        {session.manage ? (
          <Link href="/workspace/academy/holds/summary" className="rounded-full border border-white/15 px-4 py-2 text-sm text-white">
            Summary
          </Link>
        ) : null}
      </div>

      {params.error ? <p className="text-sm text-flag-critical">{params.error}</p> : null}
      {error ? <p className="text-sm text-flag-critical">{error.message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {counts.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-neutral-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <form method="get" className="grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-4">
        <Field label="Status">
          <Select name="status" defaultValue={params.status ?? ''}>
            <option value="">Open and under review</option>
            <option value="open">Open</option>
            <option value="under_review">Under Review</option>
            <option value="overdue">Overdue</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </Select>
        </Field>
        {session.manage ? (
          <Field label="Reviewer">
            <Select name="reviewer" defaultValue={params.reviewer ?? ''}>
              <option value="">Every reviewer</option>
              {queue.reviewers.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {session.manage ? (
          <Field label="Quiz">
            <Select name="quiz" defaultValue={params.quiz ?? ''}>
              <option value="">Every quiz</option>
              {queue.quizzes.map((quiz) => (
                <option key={quiz.id} value={quiz.id}>
                  {quiz.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {session.manage ? (
          <label className="flex items-end gap-2 pb-2 text-sm text-neutral-300">
            <input type="checkbox" name="unassigned" value="1" defaultChecked={params.unassigned === '1'} />
            No reviewer
          </label>
        ) : null}
        <Button type="submit" className="sm:col-span-4 sm:w-fit">
          Filter
        </Button>
      </form>

      {queue.holds.length === 0 ? (
        <p className="text-sm text-neutral-400">No holds in this view.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="px-4 py-3">Trainee</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Quiz</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3">Reviewer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Days</th>
              </tr>
            </thead>
            <tbody>
              {queue.holds.map((hold) => (
                <tr key={hold.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <Link href={`/workspace/academy/holds/${hold.id}`} className="font-medium text-white">
                      {hold.trainee_name}
                    </Link>
                    {hold.overdue ? <span className="ml-2 text-xs font-semibold text-amber-300">Overdue</span> : null}
                    {hold.unassigned ? <span className="ml-2 text-xs font-semibold text-amber-300">No reviewer</span> : null}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{hold.program}</td>
                  <td className="px-4 py-3 text-neutral-300">
                    {hold.quiz_label}
                    {hold.module_title ? ` · ${hold.module_title}` : ''}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{hold.attempts_used}</td>
                  <td className="px-4 py-3 text-neutral-300">{new Date(hold.opened_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-neutral-300">{hold.reviewer_name ?? 'Unassigned'}</td>
                  <td className="px-4 py-3 text-neutral-300">{STATUS_LABEL[hold.status] ?? hold.status}</td>
                  <td className="px-4 py-3 text-neutral-300">{hold.days_open}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
