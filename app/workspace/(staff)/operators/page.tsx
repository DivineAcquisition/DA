import type { Metadata } from 'next';
import Link from 'next/link';
import { loadOperators } from '@/lib/sales-workspace/team-data';
import { countApplicants, listJourneys } from '@/lib/operators/desk';
import { hireQueue } from '@/lib/hire/rules';
import { getSessionContext } from '@/lib/supabase/server';
import OperatorTable from '../team/workspace/components/OperatorTable';
import { DeskHeader, Problem } from '../components/desk';

export const metadata: Metadata = { title: 'Operators' };
export const dynamic = 'force-dynamic';

/** The Operators desk: the three queues at a glance, then every operator. */
export default async function OperatorsPage() {
  const session = await getSessionContext();
  const admin = Boolean(session?.isAdmin);
  const [{ data, error }, journeys, applicants] = await Promise.all([loadOperators(), listJourneys(), admin ? countApplicants() : Promise.resolve(0)]);
  if (error || !data) return <Problem>{error ?? 'The roster did not load.'}</Problem>;
  const rows = journeys.data ?? [];
  const readiness = Object.fromEntries(rows.map((row) => [row.operator_id, { operator_id: row.operator_id, stage: row.stage, met: row.met, ready: row.ready }]));
  const queues = [
    ...(admin ? [{ href: '/workspace/operators/applicants', label: 'Applicants', count: applicants, hint: 'New and in review' }] : []),
    { href: '/workspace/operators/onboarding', label: 'Onboarding', count: rows.filter((row) => hireQueue(row.stage) === 'onboarding').length, hint: 'Invited or filling in the form' },
    { href: '/workspace/operators/ready', label: 'Ready', count: rows.filter((row) => hireQueue(row.stage) === 'ready').length, hint: 'Readiness met, not placed' },
  ];

  return (
    <div className="space-y-5">
      <DeskHeader
        title="Operators"
        description="Application through ready to place. Each operator has one file; placed operators keep theirs and also appear from their placement."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {queues.map((queue) => (
          <Link key={queue.href} href={queue.href} className="panel panel-hover rounded-2xl px-5 py-4">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">{queue.label}</span>
            <span className="mt-1 block text-2xl font-semibold tabular-nums text-white">{queue.count}</span>
            <span className="text-xs text-neutral-500">{queue.hint}</span>
          </Link>
        ))}
      </div>
      {journeys.error ? <Problem>{journeys.error}</Problem> : null}
      <OperatorTable rows={data.operators} isAdmin={data.is_admin} readiness={readiness} />
    </div>
  );
}
