'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { formatDateTime, formatDay, formatMoney } from '@/lib/vistrial/format';
import { statementLines } from '@/lib/vistrial/rules/pay';
import { useOps } from '@/lib/vistrial/store';
import type { PayStatement } from '@/lib/vistrial/types';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
} from '../../components/ui';

/**
 * Statements the operator can audit line by line, down to the individual
 * bookings that produced their commission. That transparency is what prevents
 * pay disputes before they start.
 */
export default function OperatorPayPage() {
  const { gateway } = useOps();

  if (gateway.isAdmin) {
    return (
      <EmptyState
        title="Operator surface"
        detail="Switch to an operator workspace to see their statements."
        action={
          <Link href="/vistrial/admin/payroll" className={`${btnSecondary} ${btnSizeSm}`}>
            Go to payroll
          </Link>
        }
      />
    );
  }

  const statements = [...gateway.statements()].sort((a, b) => {
    const periodA = gateway.payPeriod(a.periodId);
    const periodB = gateway.payPeriod(b.periodId);
    return Date.parse(periodB?.start ?? '') - Date.parse(periodA?.start ?? '');
  });

  const open = statements.filter((statement) => !statement.locked);
  const paid = statements.filter((statement) => statement.locked);
  const lifetime = statements.reduce((sum, statement) => sum + statement.total, 0);
  const commissionTotal = statements.reduce((sum, statement) => sum + statement.commissionAmount, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Pay"
        title="Your statements"
        description="Pay periods run twice monthly. Base is prorated by your tier and the days you were placed. Commission pays on confirmed bookings above quota, and because quota is monthly it settles on the period that closes the month."
      />

      <StatGrid columns={3}>
        <StatTile label="Earned to date" value={formatMoney(lifetime)} tone="good" />
        <StatTile label="Commission to date" value={formatMoney(commissionTotal)} tone="brand" />
        <StatTile label="Statements" value={String(statements.length)} hint={`${paid.length} locked`} />
      </StatGrid>

      {open.length > 0 && (
        <section>
          <SectionHeader title="Current period" hint="Still open, so these numbers can still move." />
          <ul className="space-y-2.5">
            {open.map((statement) => (
              <StatementCard key={statement.id} statement={statement} defaultOpen />
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeader title="Closed periods" hint="Locked when the period closed. These do not change." />
        {paid.length === 0 ? (
          <EmptyState title="No closed statements yet" />
        ) : (
          <ul className="space-y-2.5">
            {paid.map((statement) => (
              <StatementCard key={statement.id} statement={statement} />
            ))}
          </ul>
        )}
      </section>

      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-white">Why a booking might not be on here</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
          Commission is calculated from confirmed bookings only. A booking you logged that the client&apos;s
          system never saw sits as pending until the admin approves it, and pending bookings do not pay. You can
          see exactly which ones are pending on your bookings page — nothing is hidden from you.
        </p>
        <Link href="/vistrial/operator/bookings" className={`${btnSecondary} ${btnSizeSm} mt-4`}>
          Check my pending bookings
        </Link>
      </Panel>
    </div>
  );
}

function StatementCard({
  statement,
  defaultOpen = false,
}: {
  statement: PayStatement;
  defaultOpen?: boolean;
}) {
  const { gateway } = useOps();
  const [open, setOpen] = useState(defaultOpen);

  const period = gateway.payPeriod(statement.periodId);
  const placement = gateway.placement(statement.placementId);
  const commissionBookings = gateway.bookingsByIds(statement.commissionBookingIds);

  return (
    <li>
      <Panel className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white">
                {period ? `${formatDay(period.start)} – ${formatDay(period.end)}` : statement.periodId}
              </p>
              <Badge tone={statement.locked ? 'neutral' : 'brand'}>
                {statement.locked ? 'Locked' : 'Open'}
              </Badge>
              {period?.closesMonth && <Badge tone="neutral">Month closes here</Badge>}
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {placement ? gateway.clientName(placement.clientId) : 'Unknown placement'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="text-lg font-semibold tabular-nums text-white">
              {formatMoney(statement.total)}
            </span>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="text-xs font-semibold text-brand-300 transition-colors hover:text-brand-200"
            >
              {open ? 'Hide' : 'Breakdown'}
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4">
            <ul className="space-y-3">
              {statementLines(statement).map((line, index) => (
                <li key={`${line.label}-${index}`} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white">{line.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{line.detail}</p>
                  </div>
                  <span
                    className={`shrink-0 text-[13px] font-semibold tabular-nums ${
                      line.amount < 0 ? 'text-flag-critical' : 'text-neutral-200'
                    }`}
                  >
                    {formatMoney(line.amount)}
                  </span>
                </li>
              ))}
            </ul>

            {commissionBookings.length > 0 ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                  The bookings that paid your commission
                </p>
                <ul className="divide-y divide-white/[0.05] rounded-xl bg-white/[0.02] px-3.5">
                  {commissionBookings.map((booking) => (
                    <li key={booking.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <span className="truncate text-neutral-200">{booking.customerName}</span>
                      <span className="shrink-0 tabular-nums text-neutral-600">
                        {formatDateTime(booking.scheduledFor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-xs leading-relaxed text-neutral-500">
                No commission on this statement. {statement.commissionDetail}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
              <span className="text-[13px] font-semibold text-white">Total</span>
              <span className="text-[15px] font-semibold tabular-nums text-white">
                {formatMoney(statement.total)}
              </span>
            </div>

            {statement.lockedAt && (
              <p className="text-[11px] text-neutral-600">
                Locked {formatDateTime(statement.lockedAt)}. This is an immutable record.
              </p>
            )}
          </div>
        )}
      </Panel>
    </li>
  );
}
