'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { formatDateTime, formatDay, formatMoney } from '@/lib/vistrial/format';
import { statementLines } from '@/lib/vistrial/rules/pay';
import { useOps } from '@/lib/vistrial/store';
import type { PayStatement } from '@/lib/vistrial/types';
import { AdminOnly } from '../../components/AppShell';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
  inputClass,
  labelClass,
} from '../../components/ui';

export default function PayrollPage() {
  return (
    <AdminOnly>
      <Payroll />
    </AdminOnly>
  );
}

function Payroll() {
  const { gateway, closePeriod } = useOps();
  const periods = gateway.payPeriods();
  const [selectedId, setSelectedId] = useState(periods.find((p) => p.status === 'open')?.id ?? periods[0]?.id);

  const period = periods.find((candidate) => candidate.id === selectedId);
  if (!period) return <EmptyState title="No pay periods configured" />;

  const statements = gateway.statements().filter((statement) => statement.periodId === period.id);
  const totals = statements.reduce(
    (acc, statement) => ({
      base: acc.base + statement.baseAmount,
      commission: acc.commission + statement.commissionAmount,
      bonus: acc.bonus + statement.speedBonusAmount,
      total: acc.total + statement.total,
    }),
    { base: 0, commission: 0, bonus: 0, total: 0 },
  );

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Payroll"
        title="Pay periods"
        description="Periods run twice monthly. The system works out what is owed and produces statements; it does not move money."
        actions={
          period.status === 'open' && (
            <button
              type="button"
              onClick={() => closePeriod(period.id)}
              className={`${btnPrimary} ${btnSizeSm}`}
            >
              Close period and lock statements
            </button>
          )
        }
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {periods.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => setSelectedId(candidate.id)}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
              candidate.id === selectedId
                ? 'bg-brand-500/[0.14] text-brand-100 ring-1 ring-inset ring-brand-500/25'
                : 'text-neutral-500 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {formatDay(candidate.start)} – {formatDay(candidate.end)}
            {candidate.status === 'open' && <span className="h-1.5 w-1.5 rounded-full bg-flag-good" />}
          </button>
        ))}
      </div>

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              {formatDay(period.start)} – {formatDay(period.end)}
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {period.closesMonth
                ? 'Closes the month, so commission and the speed bonus settle here.'
                : 'Mid-month period. Commission accrues but does not settle until the month closes.'}
            </p>
          </div>
          <Badge tone={period.status === 'open' ? 'brand' : 'neutral'}>
            {period.status === 'open' ? 'Open' : `Locked ${period.closedAt ? formatDateTime(period.closedAt) : ''}`}
          </Badge>
        </div>
      </Panel>

      <StatGrid>
        <StatTile label="Base" value={formatMoney(totals.base)} hint="Prorated by tier and active days" />
        <StatTile
          label="Commission"
          value={formatMoney(totals.commission)}
          hint="Confirmed bookings above quota only"
          tone={totals.commission > 0 ? 'brand' : 'neutral'}
        />
        <StatTile label="Speed bonus" value={formatMoney(totals.bonus)} hint="Monthly, all or nothing" />
        <StatTile label="Total owed" value={formatMoney(totals.total)} tone="good" />
      </StatGrid>

      <section>
        <SectionHeader title="Statements" hint={`${statements.length} for this period.`} />
        {statements.length === 0 ? (
          <EmptyState title="No statements in this period" />
        ) : (
          <ul className="space-y-2.5">
            {statements.map((statement) => (
              <StatementCard key={statement.id} statement={statement} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatementCard({ statement }: { statement: PayStatement }) {
  const { gateway, addAdjustment } = useOps();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');

  const placement = gateway.placement(statement.placementId);
  const commissionBookings = gateway.bookingsByIds(statement.commissionBookingIds);

  return (
    <li>
      <Panel className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/vistrial/admin/operators/${statement.operatorId}`}
                className="text-sm font-semibold text-white hover:text-brand-200"
              >
                {gateway.operatorName(statement.operatorId)}
              </Link>
              <Badge tone={statement.locked ? 'neutral' : 'brand'}>{statement.locked ? 'Locked' : 'Open'}</Badge>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {placement ? gateway.clientName(placement.clientId) : 'Unknown client'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="text-base font-semibold tabular-nums text-white">
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

            {commissionBookings.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                  Bookings that produced the commission
                </p>
                <ul className="space-y-1.5">
                  {commissionBookings.map((booking) => (
                    <li key={booking.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-neutral-300">{booking.customerName}</span>
                      <span className="shrink-0 tabular-nums text-neutral-600">
                        {formatDateTime(booking.scheduledFor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {statement.locked ? (
              <p className="rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-xs leading-relaxed text-neutral-500">
                This statement locked when the period closed and is now an immutable record. Corrections go on
                the next open period as an adjustment.
              </p>
            ) : adding ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className={labelClass} htmlFor={`label-${statement.id}`}>
                      Line item
                    </label>
                    <input
                      id={`label-${statement.id}`}
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      className={inputClass}
                      placeholder="Equipment stipend"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`amount-${statement.id}`}>
                      Amount
                    </label>
                    <input
                      id={`amount-${statement.id}`}
                      type="number"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className={inputClass}
                      placeholder="45 or -30"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`reason-${statement.id}`}>
                      Reason
                    </label>
                    <input
                      id={`reason-${statement.id}`}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className={inputClass}
                      placeholder="Why this is on the statement"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!label.trim() || !reason.trim() || !amount}
                    onClick={() => {
                      addAdjustment(statement.id, label.trim(), reason.trim(), Number(amount));
                      setLabel('');
                      setReason('');
                      setAmount('');
                      setAdding(false);
                    }}
                    className={`${btnPrimary} ${btnSizeSm}`}
                  >
                    Add adjustment
                  </button>
                  <button type="button" onClick={() => setAdding(false)} className={`${btnSecondary} ${btnSizeSm}`}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className={`${btnSecondary} ${btnSizeSm}`}>
                Add adjustment
              </button>
            )}
          </div>
        )}
      </Panel>
    </li>
  );
}
