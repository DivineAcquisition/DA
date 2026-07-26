'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeMd, btnSizeSm } from '@/app/components/ui';
import { formatDateTime, formatMoney } from '@/lib/vistrial/format';
import { summarise } from '@/lib/vistrial/rules/bookings';
import { useOps } from '@/lib/vistrial/store';
import type { Booking } from '@/lib/vistrial/types';
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
import BenchState from '../components/BenchState';
import PlacementSwitcher from '../components/PlacementSwitcher';

export default function OperatorBookingsPage() {
  const { gateway, activePlacement } = useOps();

  if (gateway.isAdmin) {
    return (
      <EmptyState
        title="Operator surface"
        detail="Switch to an operator workspace to log a booking."
        action={
          <Link href="/vistrial/admin/bookings" className={`${btnSecondary} ${btnSizeSm}`}>
            Go to the review queue
          </Link>
        }
      />
    );
  }

  if (!activePlacement) return <BenchState />;
  return <Bookings />;
}

function Bookings() {
  const { gateway, activePlacement, logBooking } = useOps();
  const placement = activePlacement!;
  const client = gateway.client(placement.clientId)!;

  const bookings = [...gateway.bookingsFor(placement.id)].sort(
    (a, b) => Date.parse(b.scheduledFor) - Date.parse(a.scheduledFor),
  );
  const summary = summarise(bookings);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [operatorNote, setOperatorNote] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const submit = () => {
    if (!customerName.trim() || !scheduledFor) return;
    logBooking({
      placementId: placement.id,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      scheduledFor: new Date(scheduledFor).toISOString(),
      operatorNote: operatorNote.trim(),
    });
    setFeedback(customerName.trim());
    setCustomerName('');
    setCustomerPhone('');
    setScheduledFor('');
    setOperatorNote('');
  };

  return (
    <div>
      <PlacementSwitcher />

      <PageHeader
        eyebrow={client.name}
        title="Bookings"
        description="Most bookings arrive automatically from the client's system. Log one here when it happened outside that path: taken over the phone, or when the tracking failed."
      />

      <div className="space-y-8">
        <StatGrid>
          <StatTile
            label="Confirmed"
            value={String(summary.confirmed + summary.systemOnly)}
            hint="Counts toward quota and commission"
            tone="good"
          />
          <StatTile
            label="Pending review"
            value={String(summary.pendingReview)}
            hint="Visible to you, not yet payable"
            tone={summary.pendingReview > 0 ? 'warning' : 'neutral'}
          />
          <StatTile
            label="Quota"
            value={String(placement.monthlyBookingQuota)}
            hint={`${formatMoney(placement.commissionPerBooking)} each above it`}
          />
          <StatTile
            label="Rejected"
            value={String(summary.rejected)}
            tone={summary.rejected > 0 ? 'critical' : 'neutral'}
          />
        </StatGrid>

        {feedback && (
          <Panel className="border-brand-500/25 bg-brand-500/[0.07] p-5">
            <Badge tone="brand">Logged</Badge>
            <p className="mt-2 text-sm leading-relaxed text-white">
              Your entry for {feedback} is in. If it matches a booking the client&apos;s system already
              recorded it is confirmed straight away; if not it sits as pending until the admin reviews it.
            </p>
          </Panel>
        )}

        <section>
          <SectionHeader title="Log a booking" hint="Give as much identifying detail as you can so it matches." />
          <Panel className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="customerName">
                  Customer name *
                </label>
                <input
                  id="customerName"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className={inputClass}
                  placeholder="Ruth Adeyemi"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="customerPhone">
                  Phone number
                </label>
                <input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  className={inputClass}
                  placeholder="+1 312 555 0101"
                />
                <p className="mt-1 text-xs text-neutral-600">
                  The strongest match signal. Include it whenever you have it.
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="scheduledFor">
                  Appointment date and time *
                </label>
                <input
                  id="scheduledFor"
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="operatorNote">
                  Why it was logged manually
                </label>
                <input
                  id="operatorNote"
                  value={operatorNote}
                  onChange={(event) => setOperatorNote(event.target.value)}
                  className={inputClass}
                  placeholder="Booked over the phone while the CRM was down."
                />
              </div>
            </div>

            <button
              type="button"
              disabled={!customerName.trim() || !scheduledFor}
              onClick={submit}
              className={`${btnPrimary} ${btnSizeMd} mt-5 w-full sm:w-auto`}
            >
              Log this booking
            </button>
          </Panel>
        </section>

        <section>
          <SectionHeader
            title="Your bookings this placement"
            hint="Nothing is hidden: every state you can be in is shown."
          />
          {bookings.length === 0 ? (
            <EmptyState title="No bookings on this placement yet" />
          ) : (
            <ul className="space-y-2">
              {bookings.slice(0, 40).map((booking) => (
                <BookingRow key={booking.id} booking={booking} />
              ))}
            </ul>
          )}
        </section>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-white">How your bookings are counted</h2>
          <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-neutral-400">
            <li className="flex gap-3">
              <Badge tone="good">Confirmed</Badge>
              <span>Counts toward your quota and your commission.</span>
            </li>
            <li className="flex gap-3">
              <Badge tone="warning">Pending</Badge>
              <span>
                You logged it, the client&apos;s system did not see it. It shows here so nothing feels hidden,
                but it does not reach your commission until the admin approves it.
              </span>
            </li>
            <li className="flex gap-3">
              <Badge tone="neutral">System</Badge>
              <span>
                Came through automatically and you never logged it. Already credited — no action needed.
              </span>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const state = {
    confirmed: { tone: 'good' as const, label: 'Confirmed' },
    'system-only': { tone: 'neutral' as const, label: 'System' },
    'pending-review': { tone: 'warning' as const, label: 'Pending' },
    rejected: { tone: 'critical' as const, label: 'Rejected' },
  }[booking.state];

  return (
    <li>
      <Panel className="px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Badge tone={state.tone}>{state.label}</Badge>
            <p className="truncate text-sm text-neutral-200">{booking.customerName}</p>
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-neutral-600">
            {formatDateTime(booking.scheduledFor)}
          </span>
        </div>
        {booking.operatorNote && (
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{booking.operatorNote}</p>
        )}
        {booking.rejectionReason && (
          <p className="mt-1.5 text-xs leading-relaxed text-flag-critical">{booking.rejectionReason}</p>
        )}
      </Panel>
    </li>
  );
}
