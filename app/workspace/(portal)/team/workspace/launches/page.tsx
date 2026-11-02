import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

type Row = {
  placement_id: string;
  operator: string;
  client: string;
  start_date: string | null;
  display_status: string;
  day_number: number | null;
  open_items: number;
  health: string | null;
  first_eod: boolean;
  targets_set: boolean;
  first_report: string;
  review_status: string;
  problem: boolean;
};

export default async function LaunchesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = '', q = '' } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await controlRpc<Row[]>(supabase, 'so_launch_board');
  const needle = q.trim().toLowerCase();
  const rows = (data ?? []).filter((row) => {
    const matchesStatus = !status || row.display_status === status;
    const hay = `${row.operator} ${row.client}`.toLowerCase();
    return matchesStatus && (!needle || hay.includes(needle));
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Launches</h1>
        <p className="mt-1 text-sm text-neutral-400">Drafts, scheduled placements, and the first 30 days. Problems are listed first.</p>
      </div>
      <form className="flex flex-wrap gap-2" action="/workspace/team/workspace/launches">
        <input name="q" defaultValue={q} placeholder="Search" className="h-9 rounded-lg border border-white/10 bg-transparent px-3 text-sm" />
        <select name="status" defaultValue={status} className="h-9 rounded-lg border border-white/10 bg-transparent px-3 text-sm">
          <option value="">All</option>
          {['draft', 'scheduled', 'active', 'paused'].map((item) => (
            <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>
          ))}
        </select>
        <button className="h-9 rounded-lg border border-white/10 px-3 text-sm" type="submit">Filter</button>
      </form>
      {error ? <p className="text-sm text-amber-200">{readable(error)}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr>
              {['Operator', 'Client', 'Start', 'Day', 'Checklist', 'Health', 'First EOD', 'Targets', 'First report', '30-day review'].map((heading) => (
                <th key={heading} className="py-2 pr-3">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.placement_id} className="border-t border-white/10">
                <td className="py-2 pr-3">
                  <Link className="text-white underline" href={`/workspace/sales-ops/placements/${row.placement_id}?tab=checklist`}>{row.operator}</Link>
                </td>
                <td className="py-2 pr-3 text-neutral-300">{row.client}</td>
                <td className="py-2 pr-3 text-neutral-300">{row.start_date ?? '—'}</td>
                <td className="py-2 pr-3 text-neutral-300">{row.day_number ?? '—'}</td>
                <td className={`py-2 pr-3 ${row.open_items > 0 ? 'text-red-300' : 'text-neutral-300'}`}>{row.open_items}</td>
                <td className="py-2 pr-3 text-neutral-300">{row.health ?? '—'}</td>
                <td className="py-2 pr-3 text-neutral-300">{row.first_eod ? 'Yes' : 'No'}</td>
                <td className="py-2 pr-3 text-neutral-300">{row.targets_set ? 'Set' : 'Not set'}</td>
                <td className="py-2 pr-3 text-neutral-300">{row.first_report}</td>
                <td className="py-2 text-neutral-300">{row.review_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
