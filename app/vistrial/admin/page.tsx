'use client';

import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { formatPercent } from '@/lib/vistrial/format';
import { EXCEPTION_KIND_LABELS } from '@/lib/vistrial/rules/exceptions';
import { useOps } from '@/lib/vistrial/store';
import type { Exception } from '@/lib/vistrial/types';
import { AdminOnly } from '../components/AppShell';
import {
  Badge,
  Dot,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
} from '../components/ui';

/**
 * The landing view answers one question: where do I need to look today. It is a
 * queue in fixed priority order, not a wall of charts.
 */
export default function AdminTodayPage() {
  return (
    <AdminOnly>
      <Today />
    </AdminOnly>
  );
}

function ExceptionRow({ exception }: { exception: Exception }) {
  const { gateway } = useOps();
  const tone = exception.severity === 'critical' ? 'critical' : 'warning';

  return (
    <li>
      <Link href={exception.href} className="panel panel-hover block rounded-2xl px-5 py-4">
        <div className="flex items-start gap-3.5">
          <span className="mt-1.5">
            <Dot tone={tone} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone}>{EXCEPTION_KIND_LABELS[exception.kind]}</Badge>
              {exception.clientId && (
                <span className="text-[11px] text-neutral-500">{gateway.clientName(exception.clientId)}</span>
              )}
            </div>
            <p className="mt-2 text-sm font-medium text-white">{exception.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">{exception.detail}</p>
          </div>
          <svg
            aria-hidden
            className="mt-1 h-4 w-4 shrink-0 text-neutral-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" />
          </svg>
        </div>
      </Link>
    </li>
  );
}

function Today() {
  const { gateway } = useOps();
  const exceptions = gateway.exceptions();
  const critical = exceptions.filter((exception) => exception.severity === 'critical');
  const warnings = exceptions.filter((exception) => exception.severity === 'warning');

  const live = gateway.livePlacements();
  const bench = gateway.bench();

  const onShiftCompliance = live.map((placement) => ({
    placement,
    metrics: gateway.metricsFor(placement.id),
  }));

  const averageCompliance =
    onShiftCompliance.length === 0
      ? 0
      : onShiftCompliance.reduce((sum, item) => sum + item.metrics.responseComplianceRate, 0) /
        onShiftCompliance.length;

  const averageEod =
    onShiftCompliance.length === 0
      ? 0
      : onShiftCompliance.reduce((sum, item) => sum + item.metrics.eodSubmissionRate, 0) /
        onShiftCompliance.length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Today"
        title="Where do I need to look"
        description="Exceptions in fixed priority order. An unanswered escalation is a customer waiting, so it sits above everything else."
        actions={
          <>
            <Link href="/vistrial/admin/bookings" className={`${btnSecondary} ${btnSizeSm}`}>
              Review claims
            </Link>
            <Link href="/vistrial/admin/operators" className={`${btnSecondary} ${btnSizeSm}`}>
              Operator roster
            </Link>
          </>
        }
      />

      <StatGrid>
        <StatTile
          label="Needs attention"
          value={String(exceptions.length)}
          hint={`${critical.length} critical`}
          tone={critical.length > 0 ? 'critical' : 'good'}
        />
        <StatTile label="Live placements" value={String(live.length)} hint={`${bench.length} on bench`} />
        <StatTile
          label="Response compliance"
          value={formatPercent(averageCompliance)}
          hint="Across live placements this month"
          tone={averageCompliance >= 0.9 ? 'good' : 'warning'}
        />
        <StatTile
          label="EOD submission"
          value={formatPercent(averageEod)}
          hint="Leading indicator, watched first"
          tone={averageEod >= 0.95 ? 'good' : 'warning'}
        />
      </StatGrid>

      <section>
        <SectionHeader
          title="Act now"
          hint="Overdue escalations, operators below standard on shift, and missed reports."
        />
        {critical.length === 0 ? (
          <EmptyState
            title="Nothing critical open"
            detail="No overdue escalations, no operator below the response standard on shift, and no missed reports from yesterday."
          />
        ) : (
          <ul className="space-y-2.5">
            {critical.map((exception) => (
              <ExceptionRow key={exception.id} exception={exception} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader
          title="Watch this week"
          hint="Claims to review, quota risk, and terms coming to an end."
        />
        {warnings.length === 0 ? (
          <EmptyState title="Nothing on the watch list" />
        ) : (
          <ul className="space-y-2.5">
            {warnings.map((exception) => (
              <ExceptionRow key={exception.id} exception={exception} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader title="On shift now" hint="Live placements and how they are tracking this month." />
        <ul className="space-y-2.5">
          {onShiftCompliance.map(({ placement, metrics }) => (
            <li key={placement.id}>
              <Link
                href={`/vistrial/admin/operators/${placement.operatorId}`}
                className="panel panel-hover block rounded-2xl px-5 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{gateway.operatorName(placement.operatorId)}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {gateway.clientName(placement.clientId)} · {placement.shiftStart}–{placement.shiftEnd}{' '}
                      {placement.timeZone.split('/')[1]?.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={metrics.responseComplianceRate >= 0.9 ? 'good' : 'critical'}>
                      {formatPercent(metrics.responseComplianceRate)} response
                    </Badge>
                    <Badge tone={metrics.quotaProgress >= 1 ? 'good' : 'neutral'}>
                      {metrics.confirmedBookings}/{metrics.monthlyQuota} booked
                    </Badge>
                    {metrics.pendingBookings > 0 && (
                      <Badge tone="warning">{metrics.pendingBookings} pending</Badge>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {bench.length > 0 && (
        <section>
          <SectionHeader
            title="On the bench"
            hint="Certified and available. This is what makes same-week replacement possible."
          />
          <Panel className="divide-y divide-white/[0.05] px-5">
            {bench.map((operator) => (
              <div key={operator.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div>
                  <Link
                    href={`/vistrial/admin/operators/${operator.id}`}
                    className="text-sm font-medium text-white hover:text-brand-200"
                  >
                    {operator.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Tier {operator.tier} · certified {operator.certifiedOn} · {operator.timeZone}
                  </p>
                </div>
                <Badge tone="warning">Available</Badge>
              </div>
            ))}
          </Panel>
        </section>
      )}
    </div>
  );
}
