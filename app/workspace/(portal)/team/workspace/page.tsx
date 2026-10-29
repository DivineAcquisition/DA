import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc } from '@/lib/ad/rpc';
import { loadToday } from '@/lib/sales-workspace/team-data';
import { createClient } from '@/lib/supabase/server';
import { RefreshNote } from './components/Bits';
import { DomainForm } from './components/Forms';
import OperatorTable from './components/OperatorTable';

export const metadata: Metadata = { title: 'Team Workspace' };
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const supabase = await createClient();
  await controlRpc(supabase, 'so_eod_sweep');
  const review = await controlRpc<unknown[]>(supabase, 'so_eod_index', { p_filter: 'needs_review' });
  const { data, error } = await loadToday();
  if (error || !data) {
    return <p className="panel rounded-2xl px-5 py-4 text-sm text-flag-critical">{error ?? 'The team view did not load.'}</p>;
  }
  const { summary } = data;
  const tiles = [
    ['On shift', summary.on_shift],
    ['Off shift', summary.off_shift],
    ['Not a working day', summary.not_working_day],
    ['EOD submitted', summary.eod.submitted],
    ['EOD draft', summary.eod.draft],
    ['EOD not started', summary.eod.not_started],
    ['EOD late', summary.eod.late],
    ['EOD missed', summary.eod.missed],
    ['Overdue tasks', summary.overdue_tasks],
    ['Unread alerts', summary.unread_alerts],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Today</h1>
          <p className="mt-1 text-sm text-neutral-400">Active and paused placements. Times show in your zone, with the operator&apos;s local time beside them.</p>
        </div>
        <RefreshNote minutes={data.refresh_minutes} at={data.refreshed_at} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="panel rounded-2xl px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
        <Link href="/workspace/team/workspace/eods?status=needs_review" className="panel rounded-2xl px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Needs review</p>
          <p className="mt-1 text-xl font-semibold text-white">{review.data?.length ?? 0}</p>
        </Link>
        {data.is_admin ? (
          <div className="panel rounded-2xl px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Open mismatches</p>
            <p className="mt-1 text-xl font-semibold text-white">{summary.open_mismatches ?? 0}</p>
          </div>
        ) : null}
      </div>
      <OperatorTable rows={data.operators} isAdmin={data.is_admin} />
      {data.is_admin && data.domain ? (
        <DomainForm
          origin={data.domain.origin}
          alsoActive={data.domain.also_active ?? []}
          retired={data.domain.retired ?? []}
          minutes={data.refresh_minutes}
        />
      ) : null}
    </div>
  );
}
