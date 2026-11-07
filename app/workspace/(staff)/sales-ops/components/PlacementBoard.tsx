import Link from 'next/link';
import { sweepPlacements } from '@/lib/placement/actions';
import type { BoardRow } from '@/lib/placement/types';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { formatDate } from '@/lib/workspace/format';
import { createClient } from '@/lib/supabase/server';
import { Badge, DataTable, EmptyState } from '../../components/ui';

const STATUS: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
};

const GHL: Record<string, string> = {
  connected: 'Connected',
  needs_attention: 'Needs attention',
  disconnected: 'Disconnected',
  not_connected: 'Not connected',
};

export default async function PlacementBoard({ query = '', status = '' }: { query?: string; status?: string }) {
  await sweepPlacements().catch(() => undefined);
  const supabase = await createClient();
  const { data, error } = await controlRpc<BoardRow[]>(supabase, 'so_placement_board');
  if (error || !data) {
    return <p className="text-sm text-amber-200">{error ? readable(error) : 'Placements did not load.'}</p>;
  }
  const needle = query.trim().toLowerCase();
  const rows = data.filter((row) => {
    const matchesStatus = !status || row.display_status === status;
    const hay = `${row.operator ?? ''} ${row.client ?? ''} ${row.manager ?? ''}`.toLowerCase();
    return matchesStatus && (!needle || hay.includes(needle));
  });
  if (rows.length === 0) {
    return <EmptyState title="No placements match." description="Drafts, scheduled placements, and live placements are listed here." />;
  }
  return (
    <DataTable headers={['Operator', 'Client', 'Manager', 'Start', 'Status', 'Checklist', 'GHL']}>
      {rows.map((row) => {
        const href = row.placement_id
          ? `/workspace/placements/${row.placement_id}`
          : `/workspace/placements/new?draft=${row.wizard_id}`;
        return (
          <tr key={row.placement_id ?? row.wizard_id}>
            <td className="px-4 py-3">
              <Link href={href} className="font-medium text-white hover:underline">
                {row.operator ?? 'Operator not chosen'}
              </Link>
              {row.display_status === 'draft' && row.wizard_id ? (
                <Link href={`/workspace/placements/new?draft=${row.wizard_id}`} className="mt-1 block text-xs text-neutral-400 underline">
                  Continue draft
                </Link>
              ) : null}
            </td>
            <td className="px-4 py-3 text-neutral-300">{row.client ?? '—'}</td>
            <td className="px-4 py-3 text-neutral-300">{row.manager ?? '—'}</td>
            <td className="whitespace-nowrap px-4 py-3 text-neutral-300">{row.start_date ? formatDate(row.start_date) : '—'}</td>
            <td className="px-4 py-3">
              <Badge tone={row.display_status === 'active' ? 'success' : row.display_status === 'paused' ? 'accent' : 'neutral'}>
                {STATUS[row.display_status] ?? row.display_status}
              </Badge>
            </td>
            <td className="px-4 py-3 text-neutral-300">{row.open_items == null ? '—' : row.open_items === 0 ? 'Clear' : `${row.open_items} open`}</td>
            <td className="px-4 py-3 text-neutral-300">{GHL[row.ghl_status] ?? row.ghl_status}</td>
          </tr>
        );
      })}
    </DataTable>
  );
}
