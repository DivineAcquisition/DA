import { Badge, Panel, type Tone } from '@/app/vistrial/components/ui';
import type { GrowthRow } from '@/lib/da/queries';

/**
 * Shared growth rendering. Rule 3 lives here: the table takes the whole metric
 * set and separates it by direction of travel rather than dropping the losses.
 */

export function formatMetric(value: number | null, unit: string): string {
  if (value === null || value === undefined) return '—';

  switch (unit) {
    case 'currency':
      return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    case 'percent':
      return `${Number(value).toFixed(1)}%`;
    case 'minutes': {
      const minutes = Number(value);
      if (minutes < 60) return `${minutes.toFixed(0)} min`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ${Math.round(minutes % 60)}m`;
    }
    default:
      return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
}

export function changeLabel(row: GrowthRow): string {
  if (row.percent_change === null || row.percent_change === undefined) return '—';
  const pct = Number(row.percent_change);
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

export function MetricRow({ row }: { row: GrowthRow }) {
  const measured = row.improved === true;
  const worse = row.improved === false;
  const tone: Tone = measured ? 'good' : worse ? 'critical' : 'neutral';

  return (
    <div className="grid grid-cols-2 items-baseline gap-x-4 gap-y-1.5 border-t border-white/[0.05] py-3.5 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
      <div className="col-span-2 sm:col-span-1">
        <p className="text-[13px] font-medium text-white">{row.label}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-600">
          {row.baseline_source === 'client_estimate' && (
            <span className="text-flag-warning">baseline was the client&apos;s estimate</span>
          )}
          {row.baseline_source === 'measured' && <span>baseline measured</span>}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600 sm:hidden">
          Baseline
        </p>
        <p className="text-[13px] tabular-nums text-neutral-400">
          {formatMetric(row.baseline_value === null ? null : Number(row.baseline_value), row.unit)}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600 sm:hidden">Now</p>
        <p className="text-[13px] font-semibold tabular-nums text-white">
          {formatMetric(row.current_value === null ? null : Number(row.current_value), row.unit)}
        </p>
      </div>

      <div className="flex sm:justify-end">
        {row.improved === null ? (
          <span className="text-[11px] text-neutral-600">not comparable</span>
        ) : (
          <Badge tone={tone}>{changeLabel(row)}</Badge>
        )}
      </div>
    </div>
  );
}

export function GrowthTable({ rows }: { rows: GrowthRow[] }) {
  const improved = rows.filter((row) => row.improved === true);
  const worsened = rows.filter((row) => row.improved === false);
  const unknown = rows.filter((row) => row.improved === null);

  return (
    <div className="space-y-6">
      <Panel className="px-5 py-2">
        <div className="hidden grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-4 pb-2 pt-3 sm:grid">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">Metric</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">Baseline</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">Now</p>
          <p className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
            Change
          </p>
        </div>

        {improved.map((row) => (
          <MetricRow key={row.metric_key} row={row} />
        ))}

        {worsened.length > 0 && (
          <>
            <div className="border-t border-white/[0.05] pb-1 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-flag-critical">
                Moved the wrong way
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Shown because a report that only surfaces the good numbers is marketing, and it fails the
                first time a client pushes back.
              </p>
            </div>
            {worsened.map((row) => (
              <MetricRow key={row.metric_key} row={row} />
            ))}
          </>
        )}

        {unknown.length > 0 && (
          <>
            <div className="border-t border-white/[0.05] pb-1 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Not yet comparable
              </p>
            </div>
            {unknown.map((row) => (
              <MetricRow key={row.metric_key} row={row} />
            ))}
          </>
        )}
      </Panel>

      <p className="text-xs leading-relaxed text-neutral-500">
        {improved.length} of {rows.filter((row) => row.improved !== null).length} comparable metrics improved
        against the locked baseline.
        {worsened.length > 0 && ` ${worsened.length} moved the wrong way.`}
      </p>
    </div>
  );
}

export function HeadlineDelta({ rows }: { rows: GrowthRow[] }) {
  const revenue = rows.find((row) => row.metric_key === 'monthly_revenue');
  const response = rows.find((row) => row.metric_key === 'avg_lead_response_minutes');
  const dormant = rows.find((row) => row.metric_key === 'dormant_lead_count');

  const tiles = [revenue, response, dormant].filter(Boolean) as GrowthRow[];

  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] sm:grid-cols-3">
      {tiles.map((row) => (
        <div key={row.metric_key} className="bg-ink-950/85 px-5 py-5">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            {row.label}
          </dt>
          <dd className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-white">
              {formatMetric(row.current_value === null ? null : Number(row.current_value), row.unit)}
            </span>
            {row.improved !== null && (
              <Badge tone={row.improved ? 'good' : 'critical'}>{changeLabel(row)}</Badge>
            )}
          </dd>
          <dd className="mt-1.5 text-xs text-neutral-600">
            from {formatMetric(row.baseline_value === null ? null : Number(row.baseline_value), row.unit)} at
            baseline
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Sparkline-style bar series for one metric over time. */
export function SeriesBars({
  points,
  unit,
  direction,
}: {
  points: { value: number | null; period_end: string | null; kind: string }[];
  unit: string;
  direction: string;
}) {
  const values = points.map((p) => Number(p.value ?? 0));
  const max = Math.max(...values, 1);

  return (
    <div>
      <div className="flex h-20 items-end gap-1">
        {points.map((point, index) => {
          const value = Number(point.value ?? 0);
          const height = Math.max(3, (value / max) * 100);
          const isBaseline = point.kind === 'baseline';
          return (
            <div
              key={index}
              title={`${point.period_end ?? 'baseline'}: ${formatMetric(value, unit)}`}
              style={{ height: `${height}%` }}
              className={`flex-1 rounded-sm ${isBaseline ? 'bg-neutral-600' : 'bg-brand-500/70'}`}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-neutral-600">
        Grey is the baseline. {direction === 'down_is_good' ? 'Lower is better.' : 'Higher is better.'}
      </p>
    </div>
  );
}
