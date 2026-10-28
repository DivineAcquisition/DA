import Link from 'next/link';
import { statusFromDb } from '@/lib/sales-workspace/view';
import { listDefaultTargets, listMetrics, listPlacements } from '@/lib/workspace/sales-ops-queries';
import { PageHeader } from '../components/ui';
import { ws } from '../components/tokens';

export default async function SalesOpsOverviewPage() {
  const [{ rows }, metrics, targets] = await Promise.all([listPlacements(), listMetrics(), listDefaultTargets()]);
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
      body: 'Mismatch tolerance, EOD timing, edit window, certification window.',
    },
  ];

  return (
    <>
      <PageHeader
        title="Sales Operator workspace"
        description="Set up placements, metrics, targets, and EOD rules. Operators enter the workspace once certified at Level 1 and placed."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className={`${ws.card} panel-hover p-5`}>
            <p className={`${ws.heading} text-base font-semibold`}>{c.title}</p>
            <p className="mt-1.5 text-sm text-[var(--ws-dim)]">{c.body}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
