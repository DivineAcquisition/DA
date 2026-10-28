import type { Metadata } from 'next';
import Link from 'next/link';
import { EOD_LABEL, type EodStatus } from '@/lib/sales-workspace/team';
import { loadEods, loadOperators } from '@/lib/sales-workspace/team-data';
import { EodPill, When } from '../components/Bits';

export const metadata: Metadata = { title: 'EODs' };
export const dynamic = 'force-dynamic';

export default async function EodsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; feedback?: string; operator?: string; manager?: string; client?: string }>;
}) {
  const query = await searchParams;
  const [loaded, roster] = await Promise.all([
    loadEods({
      from: query.from,
      to: query.to,
      status: query.status,
      operatorId: query.operator,
      managerId: query.manager,
      clientId: query.client,
      hasFeedback: query.feedback === 'yes' ? true : query.feedback === 'no' ? false : null,
    }),
    loadOperators(),
  ]);
  const { data, error } = loaded;
  const operators = roster.data?.operators ?? [];
  const managers = unique(operators.flatMap((row) => (row.manager_id && row.manager_name ? [[row.manager_id, row.manager_name] as const] : [])));
  const clients = unique(operators.flatMap((row) => (row.client_id && row.client_name ? [[row.client_id, row.client_name] as const] : [])));
  if (error || !data) {
    return <p className="panel rounded-2xl px-5 py-4 text-sm text-flag-critical">{error ?? 'EODs did not load.'}</p>;
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">EODs</h1>
        <p className="mt-1 text-sm text-neutral-400">Today and yesterday, unless you set a range. Open a report to read it. Nothing here can be edited.</p>
      </div>
      <form className="flex flex-wrap gap-2" method="get">
        <input type="date" name="from" defaultValue={query.from ?? ''} aria-label="From" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
        <input type="date" name="to" defaultValue={query.to ?? ''} aria-label="To" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
        <select name="operator" defaultValue={query.operator ?? ''} aria-label="Operator" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">Operator</option>
          {operators.map((row) => (
            <option key={row.operator_id} value={row.operator_id}>
              {row.name}
            </option>
          ))}
        </select>
        <select name="manager" defaultValue={query.manager ?? ''} aria-label="Manager" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">Manager</option>
          {managers.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select name="client" defaultValue={query.client ?? ''} aria-label="Client" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">Client</option>
          {clients.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={query.status ?? ''} aria-label="Status" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">Status</option>
          {(Object.keys(EOD_LABEL) as EodStatus[]).map((status) => (
            <option key={status} value={status}>
              {EOD_LABEL[status]}
            </option>
          ))}
        </select>
        <select name="feedback" defaultValue={query.feedback ?? ''} aria-label="Feedback" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">Feedback</option>
          <option value="yes">Has feedback</option>
          <option value="no">No feedback</option>
        </select>
        <button type="submit" className="h-9 rounded-lg bg-white/10 px-3 text-sm text-white">
          Filter
        </button>
      </form>
      {data.eods.length === 0 ? (
        <p className="panel rounded-2xl px-6 py-10 text-center text-sm text-neutral-400">No EODs in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="pb-2">Operator</th>
                <th className="pb-2">Client</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Submitted</th>
                <th className="pb-2">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {data.eods.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]">
                  <td className="py-3">
                    <Link href={`/vistrial/team/workspace/operators/${row.operator_id}`} className="text-white">
                      {row.operator_name}
                    </Link>
                    <span className="block text-xs text-neutral-500">{row.manager_name ?? 'No manager'}</span>
                  </td>
                  <td className="py-3 text-neutral-300">{row.client_name}</td>
                  <td className="py-3">
                    <Link href={`/vistrial/team/workspace/eods/${row.id}`} className="text-white">
                      {row.work_date}
                    </Link>
                  </td>
                  <td className="py-3">
                    <EodPill status={row.status} wasLate={row.was_late} />
                  </td>
                  <td className="py-3 text-neutral-300">
                    <When iso={row.submitted_at} />
                  </td>
                  <td className="py-3 text-neutral-300">{row.feedback_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function unique(pairs: Array<readonly [string, string]>): Array<[string, string]> {
  const seen = new Map<string, string>();
  for (const [id, name] of pairs) seen.set(id, name);
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}
