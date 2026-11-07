import type { Metadata } from 'next';
import { loadOperators } from '@/lib/sales-workspace/team-data';
import { countApplicants, listJourneys } from '@/lib/operators/desk';
import { hireQueue } from '@/lib/hire/rules';
import { getSessionContext } from '@/lib/supabase/server';
import OperatorTable from '../team/workspace/components/OperatorTable';
import { DeskHeader, Problem } from '../components/desk';
import { LifecycleFlow, type FlowStage } from '../components/agentic';

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
  const onboarding = rows.filter((row) => hireQueue(row.stage) === 'onboarding').length;
  const ready = rows.filter((row) => hireQueue(row.stage) === 'ready').length;
  const placed = rows.filter((row) => row.stage === 'placed').length;
  const stages: FlowStage[] = [
    ...(admin ? [{ key: 'applicants', label: 'Applicants', count: applicants, hint: 'New and in review', href: '/workspace/operators/applicants', kind: 'person' as const }] : []),
    { key: 'onboarding', label: 'Onboarding', count: onboarding, hint: 'Invited or filling in the form', href: '/workspace/operators/onboarding', kind: 'auto' },
    { key: 'ready', label: 'Ready', count: ready, hint: 'Readiness met, not placed', href: '/workspace/operators/ready', kind: 'person' },
    { key: 'placed', label: 'Placed', count: placed, hint: 'On a live seat', href: '/workspace/placements', kind: 'auto' },
  ];
  const statuses = [
    admin && applicants ? `${applicants} application${applicants === 1 ? '' : 's'} waiting for a decision` : null,
    onboarding ? `${onboarding} operator${onboarding === 1 ? '' : 's'} working through onboarding` : null,
    ready ? `${ready} ready to place on a client` : null,
    placed ? `${placed} on a live seat` : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="space-y-5">
      <DeskHeader
        title="Operators"
        description="Application through ready to place. Each operator has one file; placed operators keep theirs and also appear from their placement."
      />
      <LifecycleFlow label="Application to ready" stages={stages} statuses={statuses.length ? statuses : ['Nothing is waiting on a person.']} />
      {journeys.error ? <Problem>{journeys.error}</Problem> : null}
      <OperatorTable rows={data.operators} isAdmin={data.is_admin} readiness={readiness} />
    </div>
  );
}
