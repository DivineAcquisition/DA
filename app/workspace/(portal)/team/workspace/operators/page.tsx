import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc } from '@/lib/ad/rpc';
import { loadOperators } from '@/lib/sales-workspace/team-data';
import { createClient, getSessionContext } from '@/lib/supabase/server';
import OperatorTable from '../components/OperatorTable';

export const metadata: Metadata = { title: 'Operators' };
export const dynamic = 'force-dynamic';

export default async function OperatorsPage() {
  const { data, error } = await loadOperators();
  if (error || !data) {
    return <p className="panel rounded-2xl px-5 py-4 text-sm text-flag-critical">{error ?? 'The roster did not load.'}</p>;
  }
  const session = await getSessionContext();
  const supabase = await createClient();
  const roster = session?.isAdmin
    ? await controlRpc<{ operator_id: string; stage: string; met: number; ready: boolean }[]>(supabase, 'hire_roster', {})
    : { data: [] as { operator_id: string; stage: string; met: number; ready: boolean }[], error: null };
  const readyCount = (roster.data ?? []).filter((row) => row.stage === 'ready' || row.ready).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Operators</h1>
          <p className="mt-1 text-sm text-neutral-400">Every operator, VA, and SDR, including those without a placement. Ready to place: {readyCount}.</p>
        </div>
        {session?.isAdmin && !session.impersonation ? (
          <Link href="/workspace/team/workspace/operators/new" className="rounded-xl bg-[#6A00FF] px-4 py-2 text-sm font-semibold text-white">Add operator</Link>
        ) : null}
      </div>
      <OperatorTable rows={data.operators} isAdmin={data.is_admin} readiness={Object.fromEntries((roster.data ?? []).map((row) => [row.operator_id, row]))} />
    </div>
  );
}
