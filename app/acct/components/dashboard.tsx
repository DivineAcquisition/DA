import { Badge, Panel, StatGrid, StatTile, type Tone } from '@/app/vistrial/components/ui';
import type { FunnelSummary } from '@/lib/acct/queries';

const money = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '—'
    : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const pct = (value: number | null | undefined, decimals = 1) =>
  value === null || value === undefined ? '—' : `${Number(value).toFixed(decimals)}%`;

const minutes = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '—';
  const total = Number(value);
  if (total < 1) return 'under a minute';
  if (total < 60) return `${total.toFixed(0)} min`;
  return `${Math.floor(total / 60)}h ${Math.round(total % 60)}m`;
};

export { money, pct, minutes };

/**
 * The headline the whole retention argument rests on: how fast inquiries are
 * answered, and revenue recovered from customers the client had written off.
 */
export function HeadlineTiles({ funnel }: { funnel: FunnelSummary }) {
  const response = funnel.totals.avg_response_minutes;
  const responseTone: Tone = response === null ? 'neutral' : response <= 5 ? 'good' : response <= 15 ? 'warning' : 'critical';

  return (
    <StatGrid>
      <StatTile
        label="Speed to lead"
        value={minutes(response)}
        hint="Average time to first contact"
        tone={responseTone}
      />
      <StatTile
        label="Appointments booked"
        value={String(funnel.totals.booked)}
        hint={`from ${funnel.totals.leads} inquiries · ${pct(funnel.rates.booking_rate)} booking rate`}
        tone="brand"
      />
      <StatTile
        label="Recovered revenue"
        value={money(funnel.totals.reactivation_revenue)}
        hint="From dormant customers, at no ad spend"
        tone={funnel.totals.reactivation_revenue > 0 ? 'good' : 'neutral'}
      />
      <StatTile
        label="Return on spend"
        value={funnel.rates.return_on_spend === null ? '—' : `${funnel.rates.return_on_spend}×`}
        hint={`${money(funnel.totals.revenue)} from ${money(funnel.totals.ad_spend)}`}
        tone={Number(funnel.rates.return_on_spend ?? 0) >= 3 ? 'good' : 'warning'}
      />
    </StatGrid>
  );
}

export function FunnelStages({ funnel }: { funnel: FunnelSummary }) {
  const stages = [
    { label: 'Inquiries', value: funnel.totals.leads, rate: null as number | null },
    { label: 'Booked', value: funnel.totals.booked, rate: funnel.rates.booking_rate },
    { label: 'Showed up', value: funnel.totals.shows, rate: funnel.rates.show_rate },
    { label: 'Closed', value: funnel.totals.closed, rate: funnel.rates.close_rate },
  ];

  const max = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <Panel className="p-5">
      <ul className="space-y-3.5">
        {stages.map((stage) => (
          <li key={stage.label}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-white">{stage.label}</span>
              <span className="text-[13px] tabular-nums text-neutral-400">
                {stage.value.toLocaleString()}
                {stage.rate !== null && (
                  <span className="ml-2 text-xs text-neutral-600">{pct(stage.rate)} of the step before</span>
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max(2, (stage.value / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function SourceTable({ funnel }: { funnel: FunnelSummary }) {
  return (
    <Panel className="px-5 py-2">
      <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-4 pb-2 pt-3 sm:grid">
        {['Source', 'Inquiries', 'Booked', 'Revenue', 'Spend'].map((heading, index) => (
          <p
            key={heading}
            className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600 ${index > 0 ? 'text-right' : ''}`}
          >
            {heading}
          </p>
        ))}
      </div>

      {funnel.by_source.map((row) => (
        <div
          key={row.source}
          className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-white/[0.05] py-3.5 sm:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]"
        >
          <p className="col-span-2 text-[13px] font-medium text-white sm:col-span-1">
            {row.source}
            {row.ad_spend === 0 && (
              <Badge tone="good" className="ml-2">
                no ad spend
              </Badge>
            )}
          </p>
          <p className="text-[13px] tabular-nums text-neutral-300 sm:text-right">{row.leads}</p>
          <p className="text-[13px] tabular-nums text-neutral-300 sm:text-right">{row.booked}</p>
          <p className="text-[13px] tabular-nums text-white sm:text-right">{money(row.revenue)}</p>
          <p className="text-[13px] tabular-nums text-neutral-500 sm:text-right">{money(row.ad_spend)}</p>
        </div>
      ))}
    </Panel>
  );
}

export function WeeklyBars({ funnel }: { funnel: FunnelSummary }) {
  const max = Math.max(...funnel.weekly.map((week) => week.booked), 1);

  return (
    <Panel className="p-5">
      <div className="flex h-24 items-end gap-1.5">
        {funnel.weekly.map((week) => (
          <div
            key={week.week}
            title={`Week of ${week.week}: ${week.booked} booked, ${money(week.revenue)}`}
            style={{ height: `${Math.max(4, (week.booked / max) * 100)}%` }}
            className="flex-1 rounded-sm bg-brand-500/70"
          />
        ))}
      </div>
      <p className="mt-2.5 text-xs text-neutral-600">
        Appointments booked per week over the period. Hover for revenue.
      </p>
    </Panel>
  );
}

export function EfficiencyTiles({ funnel }: { funnel: FunnelSummary }) {
  return (
    <StatGrid>
      <StatTile label="Cost per inquiry" value={money(funnel.rates.cost_per_lead)} />
      <StatTile label="Cost per appointment" value={money(funnel.rates.cost_per_booking)} />
      <StatTile
        label="Answered in time"
        value={pct(funnel.rates.response_compliance, 0)}
        hint="Share of inquiries answered inside the standard"
        tone={Number(funnel.rates.response_compliance ?? 0) >= 90 ? 'good' : 'warning'}
      />
      <StatTile label="Revenue in period" value={money(funnel.totals.revenue)} tone="brand" />
    </StatGrid>
  );
}
