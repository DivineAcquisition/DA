'use client';

import Script from 'next/script';
import { BOOKING_EMBED_SCRIPT, BOOKING_WIDGET_SRC } from '@/lib/assessment/config';

export default function BookingCalendar({ thankYouHref }: { thankYouHref?: string }) {
  // GHL may ignore unknown query params; the thank-you page also recovers the
  // token from sessionStorage set by PersistAssessmentToken.
  const src = thankYouHref
    ? `${BOOKING_WIDGET_SRC}?redirect_url=${encodeURIComponent(thankYouHref)}`
    : BOOKING_WIDGET_SRC;

  return (
    <div className="panel overflow-hidden rounded-3xl p-1.5 sm:p-2">
      <div className="overflow-hidden rounded-[1.25rem] bg-ink-900">
        <iframe
          src={src}
          allow="payment"
          title="Book your assessment call"
          scrolling="no"
          id="mpIoc3Ax7emItpGm17dK_1785473511688"
          className="w-full border-0"
          style={{ minHeight: 920, width: '100%', overflow: 'hidden' }}
        />
      </div>
      <Script src={BOOKING_EMBED_SCRIPT} strategy="afterInteractive" />
    </div>
  );
}
