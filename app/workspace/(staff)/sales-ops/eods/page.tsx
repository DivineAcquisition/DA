import Link from 'next/link';
import { controlRpc } from '@/lib/ad/rpc';
import { formatDate } from '@/lib/workspace/format';
import { createClient } from '@/lib/supabase/server';
import { DataTable, EmptyState, PageHeader } from '../../components/ui';

type Row = {
  id: string;
  work_date: string;
  status: string;
  was_late: boolean;
  needs_help: boolean;
  escalated_at: string | null;
  reviewed_at: string | null;
  operator_name: string;
  client_name: string;
  placement_id: string;
};

const FILTERS = [
  { id: 'needs_review', label: 'Needs review' },
  { id: 'needs_help', label: 'Needs help' },
  { id: 'late', label: 'Late' },
  { id: 'missed', label: 'Missed' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'all', label: 'All' },
] as const;

export const dynamic = 'force-dynamic';

export default async function EodQueuePage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const active = FILTERS.some((item) => item.id === filter) ? filter! : 'needs_review';
  const supabase = await createClient();
  const { data, error } = await controlRpc<Row[]>(supabase, 'so_eod_index', { p_filter: active });
  const rows = data ?? [];

  return (
    <>
      <PageHeader title="EODs" description="Submitted reports waiting on a manager or DA Admin. Needs manager help is listed first." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.id}
            href={item.id === 'needs_review' ? '/workspace/sales-ops/eods' : `/workspace/sales-ops/eods?filter=${item.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm ${active === item.id ? 'bg-brand-500/15 text-white' : 'text-[var(--ws-dim)] hover:text-white'}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {error ? <p className="text-sm text-amber-200">{error.message}</p> : null}
      {rows.length === 0 ? (
        <EmptyState title="Nothing in this list." description="Submitted EODs show here once an operator sends one." />
      ) : (
        <DataTable headers={['Day', 'Operator', 'Client', 'Status', 'Flags']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap px-4 py-3">
                <Link href={`/workspace/sales-ops/eods/${row.id}`} className="font-medium text-white hover:underline">
                  {formatDate(row.work_date)}
                </Link>
              </td>
              <td className="px-4 py-3 text-[var(--ws-dim)]">{row.operator_name}</td>
              <td className="px-4 py-3 text-[var(--ws-dim)]">{row.client_name}</td>
              <td className={`px-4 py-3 ${row.status === 'late' || row.status === 'missed' || row.escalated_at ? 'text-[#FFB020]' : 'text-[var(--ws-dim)]'}`}>
                {row.status.replaceAll('_', ' ')}
                {row.was_late ? ' · late' : ''}
              </td>
              <td className="px-4 py-3 text-[var(--ws-dim)]">
                {row.needs_help ? 'Needs help' : ''}
                {row.escalated_at ? ' Escalated' : ''}
                {row.reviewed_at ? ' Reviewed' : ''}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
