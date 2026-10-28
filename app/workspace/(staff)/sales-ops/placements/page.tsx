import Link from 'next/link';
import { PLACEMENT_TYPES } from '@/lib/sales-workspace/types';
import { isOpenEnd, STATUS_LABEL, statusFromDb } from '@/lib/sales-workspace/view';
import { formatDate } from '@/lib/workspace/format';
import { listPlacements, listRoster, salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { Badge, DataTable, EmptyState, PageHeader } from '../../components/ui';

const TONE = { pending: 'pending', active: 'success', paused: 'accent', ended: 'neutral' } as const;

export default async function PlacementsPage() {
  const role = await salesOpsRole();
  const { rows, error } = role === 'admin' ? await listPlacements() : { rows: [], error: null };
  const roster = role === 'manager' ? await listRoster() : [];

  return (
    <>
      <PageHeader
        title="Placements"
        description="One active placement per operator. A placement needs at least one positive outcome before it goes active."
        actions={
          role === 'admin' ? (
            <Link
              href="/workspace/sales-ops/placements/new"
              className="inline-flex h-9 items-center rounded-lg border border-primary bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              New placement
            </Link>
          ) : null
        }
      />
      {error ? <p className="mb-4 text-sm text-flag-critical">{error}</p> : null}
      {role === 'manager' ? (
        roster.length === 0 ? (
          <EmptyState title="No workspace placements yet." description="Pending, active, and paused placements are listed here." />
        ) : (
          <DataTable headers={['Operator', 'Client', 'Manager', 'Status', 'Shift', 'Review']}>
            {roster.map((r) => (
              <tr key={r.placement_id}>
                <td className="px-4 py-3">
                  <Link href={`/workspace/sales-ops/placements/${r.placement_id}`} className="font-medium text-white hover:underline">
                    {r.operator_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{r.client_name}</td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{r.manager_name ?? '—'}</td>
                <td className="px-4 py-3 capitalize text-[var(--ws-dim)]">{r.status}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ws-dim)]">{r.shift}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ws-dim)]">{r.review_on ? formatDate(r.review_on) : '—'}</td>
              </tr>
            ))}
          </DataTable>
        )
      ) : rows.length === 0 ? (
        <EmptyState title="No placements yet." description="Create the first one to give an operator a workspace." />
      ) : (
        <DataTable headers={['Operator', 'Client', 'Type', 'Manager', 'Shift', 'Term', 'Status']}>
          {rows.map((p) => {
            const status = statusFromDb(p.status);
            return (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/workspace/sales-ops/placements/${p.id}`} className="font-medium text-white hover:underline">
                    {p.operator?.name ?? 'Unknown operator'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{p.client?.name ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">
                  {PLACEMENT_TYPES.find((t) => t.value === p.placement_type)?.label ?? 'Not set up'}
                </td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{p.manager?.full_name || p.manager?.email || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ws-dim)]">
                  {p.shift_start}–{p.shift_end}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ws-dim)]">
                  {formatDate(p.start_date)} to {isOpenEnd(p.closed_on ?? p.end_date) ? 'no end date' : formatDate(p.closed_on ?? p.end_date)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
