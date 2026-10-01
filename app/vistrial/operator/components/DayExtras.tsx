'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import { formatDate } from '@/lib/portal/time';
import type { LiveData, PortalContext } from '@/lib/portal/types';
import { Card, CardTitle } from './portal';

/**
 * The live parts of My Day: the response clock, today so far, the week's focus
 * from the latest feedback, and any shift reviews waiting. Counts and times
 * only; tapping through goes to the record.
 */
export default function DayExtras({ live, focus }: { live: LiveData | null; focus: PortalContext['focus'] }) {
  const router = useRouter();
  const onShift = Boolean(live?.on_shift);

  useEffect(() => {
    if (!onShift) return;
    const timer = setInterval(() => router.refresh(), 60000);
    return () => clearInterval(timer);
  }, [onShift, router]);

  const unconfirmed = live?.reviews?.filter((r) => r.status === 'unconfirmed') ?? [];
  const open = live?.reviews?.filter((r) => r.status === 'open') ?? [];

  return (
    <div className="space-y-4">
      {focus ? (
        <Card className="border border-brand-500/25">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-200">Your focus this week</p>
          <p className="mt-1.5 text-base text-white">{focus.text}</p>
          <p className="mt-1 text-xs text-neutral-500">From {focus.author}&apos;s feedback</p>
        </Card>
      ) : null}

      {live?.live && onShift ? <ResponseClock live={live} /> : null}

      {live?.live && live.so_far ? <SoFar live={live} /> : null}

      {unconfirmed.length > 0 || open.length > 0 ? (
        <Card>
          <CardTitle>Shift reviews</CardTitle>
          <ul className="space-y-2">
            {[...unconfirmed, ...open].map((review) => (
              <li key={review.shift_date} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
                <span>
                  <span className="text-neutral-200">{formatDate(review.shift_date)}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    {review.status === 'unconfirmed' ? 'Unconfirmed: the recorded numbers stand' : 'Ready to confirm'}
                  </span>
                </span>
                <Link href={`/vistrial/operator/record?review=${review.shift_date}`} className={`${btnPrimary} ${btnSizeSm}`}>
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function ResponseClock({ live }: { live: LiveData }) {
  const clock = live.clock;
  const standard = live.response_standard_minutes ?? 5;
  if (!live.tracking) {
    return (
      <Card>
        <CardTitle>Response clock</CardTitle>
        <p className="text-sm text-neutral-400">Lead tracking is not connected for this client yet, so the clock has nothing to count.</p>
      </Card>
    );
  }
  const waiting = clock?.waiting ?? 0;
  const oldest = clock?.oldest_minutes ?? null;
  const over = (clock?.over_standard ?? 0) > 0;
  return (
    <Card className={over ? 'border border-flag-warning/40' : ''}>
      <CardTitle aside={<span className="text-xs text-neutral-500">Standard: first reply within {standard} minutes</span>}>
        Response clock
      </CardTitle>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className="text-2xl font-semibold tabular-nums text-white">{waiting}</p>
          <p className="text-xs text-neutral-400">{waiting === 1 ? 'lead waiting' : 'leads waiting'} for a first reply</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className={`text-2xl font-semibold tabular-nums ${over ? 'text-flag-warning' : 'text-white'}`}>
            {oldest === null ? '–' : `${Math.floor(oldest)}m`}
          </p>
          <p className="text-xs text-neutral-400">oldest wait{over ? `, past ${standard} minutes` : ''}</p>
        </div>
      </div>
      {waiting > 0 ? (
        <Link href="/vistrial/operator/playbook" className="mt-3 inline-block text-xs text-brand-200 underline-offset-4 hover:underline">
          Holding lines are the fastest first reply
        </Link>
      ) : null}
    </Card>
  );
}

function SoFar({ live }: { live: LiveData }) {
  const counts = live.so_far!;
  const touches = counts.touches_outbound === null ? null : (counts.touches_outbound ?? 0) + (counts.touches_inbound ?? 0);
  const cells: { label: string; value: number | null }[] = [
    { label: 'Touches', value: touches },
    { label: 'Conversations', value: counts.conversations },
    { label: 'Bookings', value: counts.appointments_booked },
    { label: 'Escalations', value: counts.escalations_raised },
  ];
  return (
    <Card>
      <CardTitle aside={<span className="text-xs text-neutral-500">Captured automatically</span>}>Today so far</CardTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-xl font-semibold tabular-nums text-white">{cell.value ?? '–'}</p>
            <p className="text-xs text-neutral-400">{cell.label}</p>
          </div>
        ))}
      </div>
      {!counts.tracking ? (
        <p className="mt-3 text-xs text-neutral-500">
          Touches and conversations are not captured for this client yet. You confirm them in your shift review.
        </p>
      ) : null}
    </Card>
  );
}
