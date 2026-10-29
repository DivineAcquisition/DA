import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { formatDate } from '@/lib/portal/time';
import { EOD_STATUS_LABEL, type EodListItem } from '@/lib/sales-workspace/dashboard';
import { createClient } from '@/lib/supabase/server';
import { brand } from '../WorkspaceFrame';
import { WorkspaceShell } from '../shell';

export const metadata: Metadata = { title: 'Past EODs' };
export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data, error } = await controlRpc<EodListItem[]>(supabase, 'so_eod_list');
  const rows = data ?? [];

  return (
    <WorkspaceShell>
      <Link href="/workspace/operator/workspace" className="text-sm text-neutral-400 hover:text-white">
        Back to the dashboard
      </Link>
      <h1 className={`${brand.heading} mt-3 text-2xl`}>Past EODs</h1>
      <p className="mt-2 text-sm text-neutral-400">Submitted reports on this placement. Read only.</p>
      {error ? <p className="mt-6 text-sm text-[#FFB020]">{readable(error)}</p> : null}
      {!error && rows.length === 0 ? <p className="mt-6 text-sm text-neutral-400">No past EODs.</p> : null}
      <ul className="mt-6 space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/workspace/operator/workspace/history/${row.id}`} className={`${brand.panel} block hover:border-[#937DFF]/40`}>
              <p className="text-sm font-semibold text-white">{formatDate(row.work_date, true)}</p>
              <p className="mt-1 text-sm text-neutral-300">
                {EOD_STATUS_LABEL[row.status] ?? row.status}
                {row.was_late ? ' · Late' : ''}
                {row.has_feedback ? ' · Feedback' : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </WorkspaceShell>
  );
}
