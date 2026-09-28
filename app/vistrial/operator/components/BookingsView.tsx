'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { logBookingAction } from '@/lib/portal/actions';
import { BOOKING_SOURCE, bookingState } from '@/lib/portal/labels';
import { formatDate, formatDateTime, formatMonth, fromLocalInput, toLocalInput } from '@/lib/portal/time';
import type { BookingsData } from '@/lib/portal/types';
import { Badge, inputClass, labelClass, selectClass } from '../../components/ui';
import { Card, Empty, Feedback, Sheet, useAction, usePortal, VaButton, VaFieldset } from './portal';

export default function BookingsView({ data, state }: { data: BookingsData; state: string | null }) {
  const router = useRouter();
  const search = useSearchParams();
  const [logOpen, setLogOpen] = useState(false);
  const { operatorZone } = usePortal();

  const shiftMonth = (delta: number) => {
    const d = new Date(`${data.month}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + delta);
    const params = new URLSearchParams(search.toString());
    params.set('month', d.toISOString().slice(0, 7));
    router.push(`/vistrial/operator/bookings?${params.toString()}`);
  };

  const setState = (value: string) => {
    const params = new URLSearchParams(search.toString());
    if (value) params.set('state', value);
    else params.delete('state');
    router.push(`/vistrial/operator/bookings?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Bookings</h1>
        {data.live ? (
          <VaButton type="button" onClick={() => setLogOpen(true)} className={`${btnPrimary} ${btnSizeSm}`}>
            Log a booking
          </VaButton>
        ) : (
          <Badge tone="neutral">Placement ended: history only</Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="panel rounded-xl p-3">
          <p className="text-lg font-semibold">{data.counts.counted}</p>
          <p className="text-[11px] text-neutral-500">Count toward quota</p>
        </div>
        <div className="panel rounded-xl p-3">
          <p className="text-lg font-semibold">{data.counts.pending_review}</p>
          <p className="text-[11px] text-neutral-500">Waiting for review</p>
        </div>
        <div className="panel rounded-xl p-3">
          <p className="text-lg font-semibold">{data.counts.rejected}</p>
          <p className="text-[11px] text-neutral-500">Not counted</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => shiftMonth(-1)} className={`${btnSecondary} px-3 py-1.5 text-xs`} aria-label="Previous month">
          ‹
        </button>
        <span className="min-w-32 text-center text-sm font-medium">{formatMonth(data.month)}</span>
        <button type="button" onClick={() => shiftMonth(1)} className={`${btnSecondary} px-3 py-1.5 text-xs`} aria-label="Next month">
          ›
        </button>
        <select value={state ?? ''} onChange={(e) => setState(e.target.value)} className={`${selectClass} ml-auto w-auto py-1.5 text-xs`}>
          <option value="">All states</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending_review">Waiting for review</option>
          <option value="system_only">On the calendar</option>
          <option value="rejected">Not counted</option>
        </select>
      </div>

      <Card>
        {data.bookings.length === 0 ? <Empty>No bookings for this month.</Empty> : null}
        <ul className="divide-y divide-white/[0.05]">
          {data.bookings.map((booking) => {
            const label = bookingState(booking.state, booking.counts);
            return (
              <li key={booking.id}>
                <Link href={`/vistrial/operator/bookings/${booking.id}`} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {booking.customer}
                      {booking.live_transfer ? <span className="ml-2 text-xs text-neutral-500">Live transfer</span> : null}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDateTime(booking.scheduled_for, operatorZone)} · {BOOKING_SOURCE[booking.source] ?? 'Recorded'}
                      {booking.matched ? ' · matched to the calendar' : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">{label.detail}</p>
                    {booking.state === 'rejected' && booking.rejection_reason ? (
                      <p className="mt-0.5 text-xs text-flag-critical">Reason: {booking.rejection_reason}</p>
                    ) : null}
                  </div>
                  <Badge tone={label.tone}>{label.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <p className="text-xs text-neutral-600">
        Months follow the pay calendar. Customer details open one booking at a time and only while the placement is
        active; they cannot be exported.
      </p>

      <LogBooking data={data} open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}

function LogBooking({ data, open, onClose }: { data: BookingsData; open: boolean; onClose: () => void }) {
  const { operatorZone } = usePortal();
  const action = useAction();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 86400000).toISOString(), operatorZone));
  const [live, setLive] = useState(false);
  const [note, setNote] = useState('');
  const [duplicate, setDuplicate] = useState<{ id: string; customer: string; scheduled_for: string; state: string } | null>(null);
  const [distinctReason, setDistinctReason] = useState('');

  const reset = () => {
    setName('');
    setPhone('');
    setEmail('');
    setNote('');
    setLive(false);
    setDuplicate(null);
    setDistinctReason('');
  };

  const submit = (confirmDistinct: boolean) =>
    action.run(
      () =>
        logBookingAction({
          placementId: data.placement_id,
          customerName: name,
          phone,
          email,
          scheduledFor: live ? null : fromLocalInput(when, operatorZone),
          liveTransfer: live,
          note,
          confirmDistinctFrom: confirmDistinct ? duplicate?.id ?? null : null,
          distinctReason: confirmDistinct ? distinctReason : null,
        }),
      (result) => {
        if (!result.ok) return;
        if (result.data && result.data.ok === false && result.data.duplicate) {
          setDuplicate(result.data.duplicate);
          action.setMessage(null);
          return;
        }
        reset();
        onClose();
      },
    );

  return (
    <Sheet open={open} onClose={onClose} title="Log a booking">
      <VaFieldset>
        <p className="text-sm text-neutral-400">
          It is saved as waiting for review. Only bookings from {formatDate(data.current_period_start)} onward can be logged
          here; for anything older, ask your manager.
        </p>
        <label className={`${labelClass} mt-4`}>Customer name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoComplete="off" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputClass} autoComplete="off" />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className={inputClass} autoComplete="off" />
          </div>
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">Phone or email, so DA can match it to the calendar.</p>
        <label className="mt-3 flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Live transfer, now
        </label>
        {live ? null : (
          <>
            <label className={`${labelClass} mt-3`}>Appointment (your time)</label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputClass} />
          </>
        )}
        <label className={`${labelClass} mt-3`}>Note (optional)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputClass} />

        {duplicate ? (
          <div className="mt-4 rounded-xl border border-flag-warning/40 bg-flag-warning/[0.08] p-3 text-sm">
            <p className="font-semibold text-flag-warning">This looks like a booking that already exists</p>
            <p className="mt-1 text-neutral-300">
              {duplicate.customer}, {formatDateTime(duplicate.scheduled_for, operatorZone)} ({bookingState(duplicate.state).label}).
              Logging the same booking twice is treated as a duplicate claim.
            </p>
            <Link href={`/vistrial/operator/bookings/${duplicate.id}`} className="mt-2 inline-block text-xs underline">
              Open the existing booking
            </Link>
            <label className={`${labelClass} mt-3`}>If it really is a different booking, say how</label>
            <textarea value={distinctReason} onChange={(e) => setDistinctReason(e.target.value)} rows={2} className={inputClass} />
            <button
              type="button"
              disabled={action.pending || distinctReason.trim().length < 10}
              onClick={() => submit(true)}
              className={`${btnSecondary} ${btnSizeSm} mt-2`}
            >
              It is a different booking, log it
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={action.pending || !name.trim() || (!phone.trim() && !email.trim())}
            onClick={() => submit(false)}
            className={`${btnPrimary} ${btnSizeSm} mt-4`}
          >
            Log it
          </button>
        )}
        <Feedback message={action.message} error={action.error} />
      </VaFieldset>
    </Sheet>
  );
}
