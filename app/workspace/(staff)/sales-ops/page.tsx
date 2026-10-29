import Link from 'next/link';
import { controlRpc } from '@/lib/ad/rpc';
import { statusFromDb } from '@/lib/sales-workspace/view';
import { formatDate } from '@/lib/workspace/format';
import { createClient } from '@/lib/supabase/server';
import { listDefaultTargets, listMetrics, listPlacements, listRoster, listWorkspaceAlerts, salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { DataTable, EmptyState, PageHeader } from '../components/ui';
import { ws } from '../components/tokens';

type Snapshot = {
  needs_review: number;
  late: number;
  missed: number;
  escalated: number;
  today: {
    placement_id: string;
    operator_name: string;
    client_name: string;
    work_date: string;
    status: string;
    needs_help: boolean;
    escalated: boolean;
    attention: number;
  }[];
};

export default async function SalesOpsOverviewPage() {
  const role = await salesOpsRole();
  const supabase = await createClient();
  const [{ rows }, metrics, targets, roster, alerts, snapshot] = await Promise.all([
    role === 'admin' ? listPlacements() : Promise.resolve({ rows: [], error: null }),
    listMetrics(),
    listDefaultTargets(),
    listRoster(),
    listWorkspaceAlerts(),
    controlRpc<Snapshot>(supabase, 'so_team_snapshot'),
  ]);
  const team = snapshot.data;
  const workspace = rows.filter((p) => p.placement_type);
  const count = (s: string) => workspace.filter((p) => statusFromDb(p.status) === s).length;
  const targetedMetrics = new Set(targets.filter((t) => t.daily !== null || t.weekly !== null).map((t) => t.metric_key)).size;

  const cards = [
    {
      href: '/workspace/sales-ops/placements',
      title: 'Placements',
      body: `${count('active')} active, ${count('paused')} paused, ${count('pending')} pending.`,
    },
    {
      href: '/workspace/sales-ops/metrics',
      title: 'Metrics',
      body: `${metrics.filter((m) => m.active).length} active metric definitions.`,
    },
    {
      href: '/workspace/sales-ops/targets',
      title: 'Default targets',
      body: targetedMetrics ? `${targetedMetrics} metrics have a default target.` : 'No default targets set yet.',
    },
    {
      href: '/workspace/sales-ops/tasks',
      title: 'Tasks',
      body: 'Assign a task to any operator. They see it on the dashboard, with an alert.',
    },
    {
      href: '/workspace/sales-ops/settings',
      title: 'Settings',
      body: 'Mismatch tolerance, EOD timing, certification window, and the View As idle time.',
    },
  ];

  return (
    <>
      <PageHeader
        title="Sales Operator workspace"
        description="Set up placements, metrics, targets, and EOD rules. Operators enter the workspace once certified at Level 1 and placed."
      />
      {team ? (
        <div className="mb-8 grid gap-3 sm:grid-cols-4">
          {[
            ['Needs review', team.needs_review, '/workspace/sales-ops/eods'],
            ['Late', team.late, '/workspace/sales-ops/eods?filter=late'],
            ['Missed', team.missed, '/workspace/sales-ops/eods?filter=missed'],
            ['Escalated', team.escalated, '/workspace/sales-ops/eods?filter=escalated'],
          ].map(([label, count, href]) => (
            <Link key={String(label)} href={String(href)} className={`${ws.card} p-4`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">{label}</p>
              <p className={`${ws.heading} mt-1 text-2xl`}>{count as number}</p>
            </Link>
          ))}
        </div>
      ) : null}
      {role === 'admin' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className={`${ws.card} panel-hover p-5`}>
              <p className={`${ws.heading} text-base font-semibold`}>{c.title}</p>
              <p className="mt-1.5 text-sm text-[var(--ws-dim)]">{c.body}</p>
            </Link>
          ))}
        </div>
      ) : null}

      <section className="mt-10 space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">Alerts</h2>
        {alerts.length === 0 ? (
          <EmptyState title="No alerts." description="Certification grace periods and placement reviews show up here." />
        ) : (
          <DataTable headers={['When', 'Operator', 'Alert']}>
            {alerts.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ws-dim)]">{formatDate(a.period_on)}</td>
                <td className="px-4 py-3 text-white">{a.operator_name}</td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{a.summary}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      {team ? (
        <section className="mt-10 space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">Today</h2>
          {team.today.length === 0 ? (
            <EmptyState title="No active operators." description="An active placement shows here once the shift day starts." />
          ) : (
            <DataTable headers={['Operator', 'Client', 'EOD', 'Flags']}>
              {team.today.map((row) => (
                <tr key={row.placement_id}>
                  <td className="px-4 py-3">
                    <Link href={`/workspace/sales-ops/placements/${row.placement_id}`} className="font-medium text-white hover:underline">
                      {row.operator_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--ws-dim)]">{row.client_name}</td>
                  <td className={`px-4 py-3 ${row.status === 'late' || row.status === 'missed' ? 'text-[#FFB020]' : 'text-[var(--ws-dim)]'}`}>
                    {row.status.replaceAll('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-[var(--ws-dim)]">
                    {row.needs_help ? 'Needs help' : ''}
                    {row.escalated ? ' Escalated' : ''}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      ) : null}

      <section className="mt-10 space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">Operators</h2>
        {roster.length === 0 ? (
          <EmptyState title="No workspace placements yet." description="A placement shows here once it has a type and is pending, active, or paused." />
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
                <td className="px-4 py-3 text-[var(--ws-dim)]">{r.status}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ws-dim)]">{r.shift}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--ws-dim)]">{r.review_on ? formatDate(r.review_on) : '—'}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </>
  );
}
