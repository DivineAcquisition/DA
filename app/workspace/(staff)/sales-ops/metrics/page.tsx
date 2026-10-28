import { METRIC_CATEGORIES, METRIC_SOURCES } from '@/lib/sales-workspace/types';
import { listMetrics, salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { Badge, EmptyState, PageHeader } from '../../components/ui';
import { ws } from '../../components/tokens';
import MetricEditor from '../components/MetricEditor';

export default async function MetricsPage() {
  const [metrics, role] = await Promise.all([listMetrics(), salesOpsRole()]);
  const canEdit = role === 'admin';

  return (
    <>
      <PageHeader
        title="Metric definitions"
        description="What operators log and what GHL reports. GHL-only metrics are never editable by operators."
      />
      {metrics.length === 0 ? (
        <EmptyState title="No metrics loaded." description="Run the workspace migration to load the metric definitions." />
      ) : (
        <div className="space-y-8">
          {METRIC_CATEGORIES.map((cat) => {
            const list = metrics.filter((m) => m.category === cat.value);
            if (list.length === 0) return null;
            return (
              <section key={cat.value} className="space-y-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">{cat.label}</h2>
                {list.map((m) => (
                  <details key={m.key} className={`${ws.card} p-4`}>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-white">{m.label}</span>
                      <Badge tone={m.source === 'ghl' ? 'accent' : 'neutral'}>
                        {METRIC_SOURCES.find((s) => s.value === m.source)?.label ?? m.source}
                      </Badge>
                      {m.operator_editable ? null : <Badge>Not operator-editable</Badge>}
                      {m.by_outcome ? <Badge>Per outcome</Badge> : null}
                      {m.active ? null : <Badge tone="error">Inactive</Badge>}
                      {m.description ? <span className="w-full text-[var(--ws-dim)]">{m.description}</span> : null}
                    </summary>
                    {canEdit ? (
                      <div className="mt-4">
                        <MetricEditor metric={m} />
                      </div>
                    ) : null}
                  </details>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {canEdit ? (
        <section className={`${ws.card} mt-10 p-5 sm:p-6`}>
          <h2 className={`${ws.heading} mb-4 text-base font-semibold`}>Add a metric</h2>
          <MetricEditor />
        </section>
      ) : null}
    </>
  );
}
