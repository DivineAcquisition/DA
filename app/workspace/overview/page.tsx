import { NumberTicker } from '@/components/ui/number-ticker';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { Card, DataTable, EmptyState, PageHeader } from '../components/ui';
import { ws } from '../components/tokens';
import { loadVaOverview, vaStatusLabel } from '@/lib/workspace/va-performance';

export const dynamic = 'force-dynamic';

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-5">
      <AnimatedShinyText className="mx-0 max-w-none text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300">
        {label}
      </AnimatedShinyText>
      <p className={`${ws.heading} mt-2 text-3xl font-semibold tabular-nums`}>
        {typeof value === 'number' ? (
          <NumberTicker value={value} className="text-3xl font-semibold tracking-normal text-white" />
        ) : (
          value
        )}
      </p>
      {hint && <p className="mt-1 text-xs text-[var(--ws-dim)]">{hint}</p>}
    </Card>
  );
}

function percent(part: number, whole: number) {
  if (whole <= 0) return '—';
  return `${Math.round((part / whole) * 100)}%`;
}

export default async function OverviewPage() {
  const overview = await loadVaOverview();
  const response =
    overview.conversations > 0
      ? percent(overview.withinStandard, overview.conversations)
      : '—';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="VA performance for this month: booked appointments, quota, response time, and end-of-day reports."
      />

      {overview.error && (
        <p className="rounded-xl border border-[var(--ws-error)]/40 bg-[var(--ws-error)]/10 px-4 py-3 text-sm text-[var(--ws-error)]">
          {overview.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Placed VAs"
          value={overview.placed}
          hint={`${overview.inTraining} in training · ${overview.onBench} on bench`}
        />
        <Stat
          label="Booked"
          value={overview.confirmedBookings}
          hint={
            overview.quota > 0
              ? `${percent(overview.confirmedBookings, overview.quota)} of ${overview.quota} quota`
              : `${overview.pendingBookings} pending review`
          }
        />
        <Stat
          label="Response"
          value={response}
          hint={
            overview.conversations > 0
              ? `${overview.withinStandard} of ${overview.conversations} conversations inside standard`
              : 'No tracked conversations yet'
          }
        />
        <Stat
          label="EOD reports"
          value={overview.eodReports}
          hint={`${overview.certified} certified · ${overview.pendingBookings} bookings pending`}
        />
      </div>

      <section>
        <h2 className={`${ws.heading} mb-3.5 text-lg font-semibold`}>VA performance</h2>
        {overview.rows.length === 0 ? (
          <EmptyState
            title="No active VAs"
            description="Placed, training, certified, and bench VAs show here with this month's booking and tracking numbers."
          />
        ) : (
          <DataTable headers={['VA', 'Client', 'Status', 'Booked', 'Quota', 'Response', 'EODs']}>
            {overview.rows.map((row) => (
              <tr key={row.operatorId} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium text-white">{row.name}</td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{row.clientName ?? '—'}</td>
                <td className="px-4 py-3">{vaStatusLabel(row.status)}</td>
                <td className="px-4 py-3 tabular-nums">
                  {row.confirmedBookings}
                  {row.pendingBookings > 0 && (
                    <span className="ml-1 text-xs text-[var(--ws-pending)]">+{row.pendingBookings}</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-[var(--ws-dim)]">
                  {row.quota > 0 ? row.quota : '—'}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {row.responseRate == null ? '—' : `${Math.round(row.responseRate * 100)}%`}
                </td>
                <td className="px-4 py-3 tabular-nums">{row.eodReports}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
