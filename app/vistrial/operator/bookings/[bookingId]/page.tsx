import type { Metadata } from 'next';
import Link from 'next/link';
import { BOOKING_SOURCE, bookingState } from '@/lib/portal/labels';
import { loadPortal } from '@/lib/portal/load';
import { formatDateTime } from '@/lib/portal/time';
import type { BookingDetail } from '@/lib/portal/types';
import { Badge } from '../../../components/ui';
import { renderPortal } from '../../components/frame';

export const metadata: Metadata = { title: 'Booking' };
export const dynamic = 'force-dynamic';

/**
 * One booking. The only place a VA sees a customer's full phone and email, and
 * only while the placement is active: the database returns them as nothing once
 * it has ended.
 */
export default async function BookingPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const load = await loadPortal<BookingDetail>('booking', (rpc) => rpc<BookingDetail>('portal_booking', { p_booking_id: bookingId }));

  return renderPortal(load, 'bookings', (booking) => {
    const zone = load.kind === 'ready' ? load.context.operator.time_zone : 'UTC';
    const label = bookingState(booking.state, booking.counts);
    return (
      <div className="space-y-4">
        <Link href="/vistrial/operator/bookings" className="text-sm text-neutral-400 hover:text-white">
          ‹ Bookings
        </Link>
        <section className="panel rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-semibold">{booking.customer}</h1>
            <Badge tone={label.tone}>{label.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-400">{label.detail}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Appointment">{booking.live_transfer ? 'Live transfer, ' : ''}{formatDateTime(booking.scheduled_for, zone)}</Row>
            <Row label="Logged">{formatDateTime(booking.recorded_at, zone)}</Row>
            <Row label="Source">{BOOKING_SOURCE[booking.source] ?? 'Recorded'}</Row>
            <Row label="Matched to the calendar">{booking.matched ? 'Yes' : 'Not yet'}</Row>
            {booking.contacts_visible ? (
              <>
                <Row label="Phone">{booking.customer_phone ?? '—'}</Row>
                <Row label="Email">{booking.customer_email ?? '—'}</Row>
                {booking.operator_note ? <Row label="Your note">{booking.operator_note}</Row> : null}
              </>
            ) : (
              <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-neutral-400 sm:col-span-2">
                This placement has ended, so the customer&apos;s contact details are no longer available (Section 13.1). The
                booking still counts exactly as it did.
              </div>
            )}
            {booking.state === 'rejected' && booking.rejection_reason ? (
              <Row label="Why it was not counted">{booking.rejection_reason}</Row>
            ) : null}
          </dl>
        </section>
      </div>
    );
  });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2">
      <dt className="text-[11px] text-neutral-500">{label}</dt>
      <dd className="mt-0.5 break-words text-neutral-100">{children}</dd>
    </div>
  );
}
