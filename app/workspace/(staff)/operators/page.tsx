import type { Metadata } from 'next';
import { loadOperators } from '@/lib/sales-workspace/team-data';
import { listJourneys } from '@/lib/operators/desk';
import { getSessionContext } from '@/lib/supabase/server';
import OperatorTable from '../team/workspace/components/OperatorTable';
import { DeskHeader, Problem } from '../components/desk';

export const metadata: Metadata = { title: 'Operators' };
export const dynamic = 'force-dynamic';

/** The operator record. The live seat is the other half of the same person. */
export default async function OperatorsPage() {
  const session = await getSessionContext();
  const [{ data, error }, journeys] = await Promise.all([loadOperators(), listJourneys()]);
  if (error || !data) return <Problem>{error ?? 'The roster did not load.'}</Problem>;
  const rows = journeys.data ?? [];
  const readiness = Object.fromEntries(rows.map((row) => [row.operator_id, { operator_id: row.operator_id, stage: row.stage, met: row.met, ready: row.ready }]));

  return (
    <div className="space-y-5">
      <DeskHeader
        title="Operators"
        description="Each operator has one file. A placed operator also appears on the live seat."
      />
      {journeys.error ? <Problem>{journeys.error}</Problem> : null}
      <OperatorTable rows={data.operators} isAdmin={Boolean(session?.isAdmin) && data.is_admin} readiness={readiness} />
    </div>
  );
}
