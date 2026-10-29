import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient, getSessionContext } from '@/lib/supabase/server';
import { decideMismatchForm } from '@/lib/workspace/sales-ghl-actions';

export const metadata: Metadata = { title: 'Data integrity' };
export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  operator_name: string;
  client_name: string;
  work_date: string;
  metric_key: string;
  operator_value: number;
  ghl_value: number;
  gap: number;
  status: string;
  age_days: number;
};

export default async function IntegrityPage({ searchParams }: { searchParams: Promise<{ status?: string; id?: string }> }) {
  const session = await getSessionContext();
  if (!session?.isAdmin) {
    return <p className="panel rounded-2xl px-5 py-4 text-sm text-neutral-300">Data integrity is DA Admin only.</p>;
  }
  const query = await searchParams;
  const supabase = await createClient();
  const { data, error } = await controlRpc<Row[]>(supabase, 'so_ghl_mismatches', { p_status: query.status || null, p_operator: null, p_placement: null });
  const rows = data ?? [];
  const open = rows.filter((row) => row.status === 'open').length;
  const detail = query.id ? await controlRpc<Record<string, unknown>>(supabase, 'so_ghl_mismatch', { p_id: query.id }) : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-white">Data integrity</h1>
        <p className="mt-1 text-sm text-neutral-400">{open} open. Mismatches are DA Admin only.</p>
      </header>
      <div className="flex gap-2 text-sm">
        {['', 'open', 'resolved', 'dismissed', 'reviewed'].map((status) => (
          <Link key={status || 'all'} href={status ? `/workspace/team/workspace/integrity?status=${status}` : '/workspace/team/workspace/integrity'} className="rounded-lg bg-white/5 px-3 py-1 text-neutral-300">
            {status || 'All'}
          </Link>
        ))}
      </div>
      {error ? <p className="text-sm text-flag-critical">{readable(error)}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase text-neutral-500">
            <tr>
              <th className="pb-2">Operator</th>
              <th className="pb-2">Client</th>
              <th className="pb-2">Date</th>
              <th className="pb-2">Metric</th>
              <th className="pb-2">Logged</th>
              <th className="pb-2">GHL</th>
              <th className="pb-2">Gap</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/[0.06]">
                <td className="py-2 text-white">{row.operator_name}</td>
                <td className="py-2 text-neutral-300">{row.client_name}</td>
                <td className="py-2">
                  <Link href={`/workspace/team/workspace/integrity?id=${row.id}`} className="text-white">
                    {row.work_date}
                  </Link>
                </td>
                <td className="py-2 text-neutral-300">{row.metric_key}</td>
                <td className="py-2 tabular-nums">{row.operator_value}</td>
                <td className="py-2 tabular-nums">{row.ghl_value}</td>
                <td className="py-2 tabular-nums">{row.gap}</td>
                <td className="py-2 text-neutral-400">{row.status} · {row.age_days}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail?.data ? <Detail detail={detail.data} /> : null}
    </div>
  );
}

function Detail({ detail }: { detail: Record<string, unknown> }) {
  const evidence = (detail.evidence as { ghl_type: string; happened_at: string | null; href: string | null }[]) ?? [];
  return (
    <section className="panel space-y-3 rounded-2xl p-5 text-sm">
      <h2 className="text-base font-semibold text-white">
        {String(detail.metric_key)} · logged {String(detail.operator_value)} · GHL {String(detail.ghl_value)}
      </h2>
      <ul className="space-y-1 text-neutral-300">
        {evidence.map((item, index) => (
          <li key={index}>
            {item.ghl_type} · {item.happened_at ?? '—'}{' '}
            {item.href ? (
              <a href={item.href} className="text-brand-100">
                Open contact
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      <form action={decideMismatchForm} className="space-y-2">
        <input type="hidden" name="id" value={String(detail.id)} />
        <select name="decision" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2" defaultValue="accept_ghl">
          <option value="accept_ghl">Accept GHL</option>
          <option value="accept_operator">Accept operator</option>
          <option value="dismiss">Dismiss</option>
        </select>
        <select name="reason" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2" defaultValue="ghl_outage">
          <option value="ghl_outage">GHL outage</option>
          <option value="mapping_error">Mapping error</option>
          <option value="operator_verified">Operator verified</option>
          <option value="other">Other</option>
        </select>
        <textarea name="note" required minLength={5} rows={3} className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2" placeholder="Required note" />
        <button type="submit" className="rounded-lg bg-[#6A00FF] px-3 py-2 text-sm font-semibold text-white">
          Save decision
        </button>
      </form>
    </section>
  );
}
