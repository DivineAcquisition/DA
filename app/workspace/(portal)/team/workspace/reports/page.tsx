import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient, getSessionContext } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

const LABEL: Record<string, string> = {
  draft: 'Draft', ready: 'Ready for Review', approved: 'Approved', scheduled: 'Scheduled', sent: 'Sent', held: 'Held', failed: 'Failed',
};

type Row = {
  id: string;
  kind: string;
  status: string;
  period_start: string;
  period_end: string;
  client: string;
  operator: string;
  feedback_count: number;
  sent_at: string | null;
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const query = await searchParams;
  const [supabase, session] = await Promise.all([createClient(), getSessionContext()]);
  await controlRpc(supabase, 'so_report_sweep');
  const { data, error } = await controlRpc<Row[]>(supabase, 'so_report_list', { p_status: query.status ?? null });
  if (error) return <p className="text-sm text-[#FFB020]">{readable(error)}</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Reports</h1>
          <p className="mt-1 text-sm text-neutral-400">Ready for Review is waiting on a manager. Nothing sends until it is approved, unless that placement turned approval off.</p>
        </div>
        {session?.isAdmin ? (
          <Link href="/workspace/team/workspace/reports/deliveries" className="text-sm text-neutral-400 hover:text-white">
            Deliveries
          </Link>
        ) : null}
      </div>
      <form className="flex gap-2" method="get">
        <select name="status" defaultValue={query.status ?? ''} aria-label="Status" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">All statuses</option>
          {Object.entries(LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="rounded-lg bg-white/10 px-3 text-sm" type="submit">Filter</button>
      </form>
      <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
        {(data ?? []).length === 0 ? <li className="px-4 py-6 text-sm text-neutral-400">No reports yet.</li> : null}
        {(data ?? []).map((row) => (
          <li key={row.id}>
            <Link href={`/workspace/team/workspace/reports/${row.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.03]">
              <span>
                <span className="block text-sm font-medium text-white">{row.client}</span>
                <span className="text-xs text-neutral-400">{row.operator} · {row.kind} · {row.period_start} to {row.period_end}</span>
              </span>
              <span className="text-sm text-neutral-300">{LABEL[row.status] ?? row.status}{row.feedback_count ? ` · ${row.feedback_count} feedback` : ''}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
