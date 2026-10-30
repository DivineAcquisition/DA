import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { retryDeliveryAction } from '@/lib/sales-reports/actions';
import ReportForm from '../ReportForm';
import { createClient, getSessionContext } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Deliveries' };
export const dynamic = 'force-dynamic';

type Row = { id: string; channel: string; destination: string; status: string; at: string; error: string | null; client: string | null; attempt: number };

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<{ channel?: string; status?: string }> }) {
  const session = await getSessionContext();
  if (!session?.isAdmin) return <p className="text-sm text-neutral-400">Deliveries are for DA Admin.</p>;
  const query = await searchParams;
  const supabase = await createClient();
  const { data, error } = await controlRpc<Row[]>(supabase, 'so_delivery_list', {
    p_channel: query.channel ?? null,
    p_status: query.status ?? null,
    p_placement: null,
    p_from: null,
    p_to: null,
  });
  if (error) return <p className="text-sm text-[#FFB020]">{readable(error)}</p>;
  return (
    <div className="space-y-4">
      <Link href="/workspace/team/workspace/reports" className="text-sm text-neutral-400 hover:text-white">Reports</Link>
      <h1 className="text-2xl font-semibold text-white">Deliveries</h1>
      <form className="flex flex-wrap gap-2" method="get">
        <select name="channel" defaultValue={query.channel ?? ''} aria-label="Destination" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">All destinations</option>
          {['email', 'pdf', 'drive', 'discord', 'airtable', 'clickup'].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select name="status" defaultValue={query.status ?? ''} aria-label="Status" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">All statuses</option>
          <option>sent</option>
          <option>retrying</option>
          <option>failed</option>
        </select>
        <button className="rounded-lg bg-white/10 px-3 text-sm" type="submit">Filter</button>
      </form>
      <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
        {(data ?? []).map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>
              <span className="text-white">{row.client ?? 'DA'} · {row.channel} · {row.destination}</span>
              <span className="mt-1 block text-neutral-400">{row.status}{row.error ? ` · ${row.error}` : ''}</span>
            </span>
            {row.status === 'failed' ? (
              <ReportForm action={retryDeliveryAction}>
                <input type="hidden" name="delivery_id" value={row.id} />
                <button className="text-brand-300" type="submit">Retry</button>
              </ReportForm>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
