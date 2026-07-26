'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { formatDateTime, formatMoney } from '@/lib/vistrial/format';
import { summarise, wouldDoubleCredit } from '@/lib/vistrial/rules/bookings';
import { useOps } from '@/lib/vistrial/store';
import type { Booking } from '@/lib/vistrial/types';
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

export default function BookingReviewPage() {
  return (
    <AdminOnly>
      <ReviewQueue />
    </AdminOnly>
  );
}

function ReviewQueue() {
  const { gateway, data } = useOps();
  const queue = gateway.reviewQueue();
  const summary = summarise(data.bookings);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Booking review"
        title="Reconciliation queue"
        description="GoHighLevel is the source of truth. The manual log is the fallback, so the two are reconciled rather than added together. Claims with no matching ingested event sit here and pay nothing until approved."
      />

      <StatGrid>
        <StatTile label="Confirmed" value={String(summary.confirmed)} hint="Both sources agree" tone="good" />
        <StatTile
          label="System only"
          value={String(summary.systemOnly)}
          hint={`${Math.round(summary.unloggedRate * 100)}% of credited never logged`}
        />
        <StatTile
          label="Pending review"
          value={String(summary.pendingReview)}
          hint="Counted for the operator, not payable"
          tone={summary.pendingReview > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Rejected"
          value={String(summary.rejected)}
          hint="Recorded on the operator record"
          tone={summary.rejected > 0 ? 'critical' : 'neutral'}
        />
      </StatGrid>

      <section>
        <SectionHeader title="Awaiting a decision" hint="Oldest first." />
        {queue.length === 0 ? (
          <EmptyState
            title="Nothing awaiting review"
            detail="Every manual entry has either matched an ingested booking or already been decided."
          />
        ) : (
          <ul className="space-y-2.5">
            {queue.map((claim) => (
              <ClaimCard key={claim.id} claim={claim} />
            ))}
          </ul>
        )}
      </section>

      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-white">How a claim resolves</h2>
        <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-neutral-400">
          <li className="flex gap-3">
            <Badge tone="good">Confirmed</Badge>
            <span>
              Both sources agree, or the booking came from GoHighLevel alone. Fully credited toward quota and
              commission.
            </span>
          </li>
          <li className="flex gap-3">
            <Badge tone="warning">Pending</Badge>
            <span>
              Logged by the operator with no matching ingested event. Visible and counted in their own view as
              pending, but it does not reach commission until approved here.
            </span>
          </li>
          <li className="flex gap-3">
            <Badge tone="neutral">System only</Badge>
            <span>
              GoHighLevel recorded a booking the operator never logged. Auto-credited, no action needed. A high
              rate just means they are not bothering to log.
            </span>
          </li>
        </ul>
      </Panel>
    </div>
  );
}

function ClaimCard({ claim }: { claim: Booking }) {
  const { gateway, reviewClaim, data } = useOps();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const placement = gateway.placement(claim.placementId);
  const duplicate = wouldDoubleCredit(claim, data.bookings);

  return (
    <li>
      <Panel className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white">{claim.customerName}</p>
              <Badge tone="warning">Pending review</Badge>
              {duplicate && <Badge tone="critical">Would double-credit</Badge>}
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              <Link
                href={`/vistrial/admin/operators/${claim.operatorId}`}
                className="text-neutral-400 hover:text-brand-200"
              >
                {gateway.operatorName(claim.operatorId)}
              </Link>
              {' · '}
              <Link href={`/vistrial/admin/clients/${claim.clientId}`} className="hover:text-brand-200">
                {gateway.clientName(claim.clientId)}
              </Link>
              {' · appointment '}
              {formatDateTime(claim.scheduledFor)}
            </p>
            {claim.customerPhone && (
              <p className="mt-1 text-xs tabular-nums text-neutral-600">{claim.customerPhone}</p>
            )}
          </div>
          {placement && (
            <p className="shrink-0 text-xs text-neutral-500">
              Worth {formatMoney(placement.commissionPerBooking)} if it clears quota
            </p>
          )}
        </div>

        {claim.operatorNote && (
          <p className="mt-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-[13px] leading-relaxed text-neutral-300">
            {claim.operatorNote}
          </p>
        )}

        {duplicate && (
          <p className="mt-3 rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-[13px] leading-relaxed text-flag-critical">
            An already-credited booking matches this customer and time. Approving would pay twice for one
            appointment.
          </p>
        )}

        {rejecting ? (
          <div className="mt-4">
            <label className={labelClass} htmlFor={`reason-${claim.id}`}>
              Reason for rejection
            </label>
            <textarea
              id={`reason-${claim.id}`}
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={`${inputClass} resize-none`}
              placeholder="Recorded on the operator record, so be specific."
            />
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!reason.trim()}
                onClick={() => reviewClaim(claim.id, 'reject', reason.trim())}
                className={`${btnPrimary} ${btnSizeSm}`}
              >
                Confirm rejection
              </button>
              <button type="button" onClick={() => setRejecting(false)} className={`${btnSecondary} ${btnSizeSm}`}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reviewClaim(claim.id, 'approve', '')}
              className={`${btnPrimary} ${btnSizeSm}`}
            >
              Approve and credit
            </button>
            <button type="button" onClick={() => setRejecting(true)} className={`${btnSecondary} ${btnSizeSm}`}>
              Reject
            </button>
          </div>
        )}
      </Panel>
    </li>
  );
}
