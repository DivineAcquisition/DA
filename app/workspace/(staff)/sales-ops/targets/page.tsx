import { PLACEMENT_TYPES } from '@/lib/sales-workspace/types';
import { formatDate, formatDateTime } from '@/lib/workspace/format';
import { listDefaultTargets, listMetrics, salesOpsRole, type TargetRow } from '@/lib/workspace/sales-ops-queries';
import { DataTable, EmptyState, PageHeader } from '../../components/ui';
import DefaultTargetForm from '../components/DefaultTargetForm';

const typeLabel = (t: string | null) => (t ? PLACEMENT_TYPES.find((x) => x.value === t)?.label ?? t : 'All types');
const value = (n: number | null) => (n === null ? '—' : String(n));

/** The row standing today for each metric and type: the latest effective_from not in the future. */
function current(targets: TargetRow[], today: string): TargetRow[] {
  const seen = new Set<string>();
  const out: TargetRow[] = [];
  for (const t of targets) {
    if (t.effective_from > today) continue;
    const k = `${t.metric_key}:${t.placement_type ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (t.daily !== null || t.weekly !== null) out.push(t);
  }
  return out;
}

export default async function TargetsPage() {
  const [metrics, targets, role] = await Promise.all([listMetrics(), listDefaultTargets(), salesOpsRole()]);
  // so_set_default_target() compares against the database's current_date, which is UTC.
  const today = new Date().toISOString().slice(0, 10);
  const label = (key: string) => metrics.find((m) => m.key === key)?.label ?? key;
  const standing = current(targets, today);
  const scheduled = targets.filter((t) => t.effective_from > today);

  return (
    <>
      <PageHeader
        title="Default targets"
        description="Targets start empty. Set them here; managers can override per placement. Every change is kept with its effective date."
      />
      <div className="space-y-8">
        {role === 'admin' ? <DefaultTargetForm metrics={metrics.filter((m) => m.active)} today={today} /> : null}

        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">In effect today</h2>
          {standing.length === 0 ? (
            <EmptyState title="No default targets yet." description="Metrics without a target show the number alone, with no goal." />
          ) : (
            <DataTable headers={['Metric', 'Applies to', 'Daily', 'Weekly', 'Since']}>
              {standing.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-white">{label(t.metric_key)}</td>
                  <td className="px-4 py-3 text-[var(--ws-dim)]">{typeLabel(t.placement_type)}</td>
                  <td className="px-4 py-3">{value(t.daily)}</td>
                  <td className="px-4 py-3">{value(t.weekly)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ws-dim)]">{formatDate(t.effective_from)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        {scheduled.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">Scheduled</h2>
            <DataTable headers={['Metric', 'Applies to', 'Daily', 'Weekly', 'From']}>
              {scheduled.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-white">{label(t.metric_key)}</td>
                  <td className="px-4 py-3 text-[var(--ws-dim)]">{typeLabel(t.placement_type)}</td>
                  <td className="px-4 py-3">{value(t.daily)}</td>
                  <td className="px-4 py-3">{value(t.weekly)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ws-dim)]">{formatDate(t.effective_from)}</td>
                </tr>
              ))}
            </DataTable>
          </section>
        ) : null}

        {targets.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">History</h2>
            <DataTable headers={['Metric', 'Applies to', 'Daily', 'Weekly', 'From', 'Set', 'By', 'Note']}>
              {targets.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-white">{label(t.metric_key)}</td>
                  <td className="px-4 py-3 text-[var(--ws-dim)]">{typeLabel(t.placement_type)}</td>
                  <td className="px-4 py-3">{t.daily === null && t.weekly === null ? 'Cleared' : value(t.daily)}</td>
                  <td className="px-4 py-3">{t.daily === null && t.weekly === null ? '' : value(t.weekly)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ws-dim)]">{formatDate(t.effective_from)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ws-dim)]">{formatDateTime(t.set_at)}</td>
                  <td className="px-4 py-3 text-[var(--ws-dim)]">{t.setter?.full_name || t.setter?.email || '—'}</td>
                  <td className="px-4 py-3 text-[var(--ws-dim)]">{t.note ?? ''}</td>
                </tr>
              ))}
            </DataTable>
          </section>
        ) : null}
      </div>
    </>
  );
}
