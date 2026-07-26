import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
} from '@/app/vistrial/components/ui';
import AdminGate from '../components/AdminGate';
import { listMargin, listMonthlyMargin, listOperatorMargin } from '@/lib/da/billing';

export const dynamic = 'force-dynamic';

const money = (value: number | string | null) =>
  value === null ? '—' : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default async function MarginPage() {
  return (
    <AdminGate>
      <Margin />
    </AdminGate>
  );
}

async function Margin() {
  const [byClient, monthly, byOperator] = await Promise.all([
    listMargin(),
    listMonthlyMargin(),
    listOperatorMargin(),
  ]);

  const totals = byClient.reduce(
    (acc, row) => ({
      revenue: acc.revenue + Number(row.revenue_to_date ?? 0),
      cost: acc.cost + Number(row.operator_cost_to_date ?? 0),
      pass: acc.pass + Number(row.pass_through_to_date ?? 0),
      margin: acc.margin + Number(row.margin_to_date ?? 0),
    }),
    { revenue: 0, cost: 0, pass: 0, margin: 0 },
  );

  const overallPct = totals.revenue === 0 ? null : (totals.margin / totals.revenue) * 100;
  const unprofitable = byClient.filter((row) => Number(row.margin_to_date ?? 0) <= 0 && Number(row.revenue_to_date ?? 0) > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Margin"
        title="Which engagements actually make money"
        description="Revenue collected from each client, minus the operator cost attributable to their placements, minus direct pass-through. A client can look healthy on revenue and be unprofitable once the placed operator is paid for."
        actions={
          <Link href="/da" className={`${btnSecondary} ${btnSizeSm}`}>
            All engagements
          </Link>
        }
      />

      <StatGrid>
        <StatTile label="Revenue to date" value={money(totals.revenue)} tone="brand" />
        <StatTile label="Operator cost" value={money(totals.cost)} hint="Paid and in flight" />
        <StatTile label="Pass-through" value={money(totals.pass)} />
        <StatTile
          label="Margin"
          value={money(totals.margin)}
          hint={overallPct === null ? undefined : `${overallPct.toFixed(1)}% overall`}
          tone={totals.margin > 0 ? 'good' : 'critical'}
        />
      </StatGrid>

      {unprofitable.length > 0 && (
        <Panel className="border-flag-critical/25 bg-flag-critical/[0.06] p-5">
          <Badge tone="critical">
            {unprofitable.length} engagement{unprofitable.length === 1 ? '' : 's'} not making money
          </Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            {unprofitable.map((row) => row.name).join(', ')} {unprofitable.length === 1 ? 'is' : 'are'} at or
            below break-even once the operator cost is counted. Without this view that stays invisible until
            cash runs short.
          </p>
        </Panel>
      )}

      <section>
        <SectionHeader title="By client" hint="Ranked by margin." />
        {byClient.length === 0 ? (
          <EmptyState title="No revenue recorded yet" />
        ) : (
          <Panel className="px-5 py-2">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-4 pb-2 pt-3 sm:grid">
              {['Client', 'Revenue', 'Operator cost', 'Pass-through', 'Margin'].map((heading, index) => (
                <p
                  key={heading}
                  className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600 ${index > 0 ? 'text-right' : ''}`}
                >
                  {heading}
                </p>
              ))}
            </div>

            {byClient.map((row) => {
              const margin = Number(row.margin_to_date ?? 0);
              return (
                <div
                  key={row.case_file_id}
                  className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-white/[0.05] py-3.5 sm:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]"
                >
                  <div className="col-span-2 sm:col-span-1">
                    <Link
                      href={`/da/${row.slug}`}
                      className="text-[13px] font-medium text-white hover:text-brand-200"
                    >
                      {row.name}
                    </Link>
                    <p className="text-[11px] text-neutral-600">
                      {row.status}
                      {row.last_payment_on && ` · last paid ${row.last_payment_on}`}
                    </p>
                  </div>
                  <p className="text-[13px] tabular-nums text-neutral-300 sm:text-right">
                    {money(row.revenue_to_date)}
                  </p>
                  <p className="text-[13px] tabular-nums text-neutral-500 sm:text-right">
                    {money(row.operator_cost_to_date)}
                  </p>
                  <p className="text-[13px] tabular-nums text-neutral-500 sm:text-right">
                    {money(row.pass_through_to_date)}
                  </p>
                  <p
                    className={`text-[13px] font-semibold tabular-nums sm:text-right ${margin > 0 ? 'text-flag-good' : 'text-flag-critical'}`}
                  >
                    {money(margin)}
                    {row.margin_pct !== null && (
                      <span className="ml-1.5 text-[11px] font-normal text-neutral-600">
                        {Number(row.margin_pct).toFixed(0)}%
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </Panel>
        )}
      </section>

      {monthly.length > 0 && (
        <section>
          <SectionHeader title="Monthly trend" />
          <Panel className="px-5 py-2">
            {monthly.map((row) => (
              <div
                key={String(row.month)}
                className="flex flex-wrap items-baseline justify-between gap-3 border-t border-white/[0.05] py-3 first:border-t-0"
              >
                <span className="text-[13px] text-neutral-300">
                  {new Date(`${row.month}T00:00:00Z`).toLocaleDateString('en-GB', {
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                </span>
                <span className="flex flex-wrap items-baseline gap-4 text-[13px] tabular-nums">
                  <span className="text-neutral-500">{money(row.revenue)} in</span>
                  <span className="text-neutral-500">{money(row.operator_cost)} out</span>
                  <span className={Number(row.margin ?? 0) > 0 ? 'font-semibold text-flag-good' : 'font-semibold text-flag-critical'}>
                    {money(row.margin)}
                  </span>
                </span>
              </div>
            ))}
          </Panel>
        </section>
      )}

      {byOperator.length > 0 && (
        <section>
          <SectionHeader title="By operator" hint="What each has been paid, and across how many clients." />
          <Panel className="px-5 py-2">
            {byOperator.map((row) => (
              <div
                key={row.operator_id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-t border-white/[0.05] py-3 first:border-t-0"
              >
                <span className="text-[13px] text-neutral-200">
                  {row.name}
                  <span className="ml-2 text-[11px] text-neutral-600">tier {row.tier}</span>
                </span>
                <span className="flex flex-wrap items-baseline gap-4 text-[13px] tabular-nums">
                  <span className="text-neutral-600">
                    {row.clients_served} client{row.clients_served === 1 ? '' : 's'}
                  </span>
                  <span className="font-semibold text-white">{money(row.paid_to_date)}</span>
                </span>
              </div>
            ))}
          </Panel>
        </section>
      )}
    </div>
  );
}
