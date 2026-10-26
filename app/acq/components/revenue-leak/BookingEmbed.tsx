'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Panel } from '@/components/ui/panel';
import { REVENUE_LEAK } from '@/lib/acq/revenue-leak-content';
import { revenueLeakEmbedUrl } from '@/lib/acq/revenue-leak';
import type { NicheVisit } from '@/lib/acq/niche-tracking';

const IclosedEmbed = dynamic(() => import('../IclosedEmbed'), { ssr: false });

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return match.slice(name.length + 1);
  }
}

async function reportBooking(eventId: string, eventName: 'Schedule' | 'Lead', tracking: NicheVisit) {
  try {
    await fetch('/api/meta/acq-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        eventName,
        eventId,
        eventSourceUrl: window.location.href,
        fbp: readCookie('_fbp'),
        fbc: readCookie('_fbc'),
        fbclid: tracking.fbclid,
        contentName: 'Revenue Leak Audit',
      }),
    });
  } catch {
    // The browser pixel already fired. A blocked request skips the server copy.
  }
}

export function BookingEmbed({ tracking }: { tracking: NicheVisit }) {
  const [src, setSrc] = useState('');
  const url = REVENUE_LEAK.booking.url;
  const onBooked = useCallback(
    (eventId: string, eventName: 'Schedule' | 'Lead') => {
      void reportBooking(eventId, eventName, tracking);
    },
    [tracking],
  );

  useEffect(() => {
    const node = document.getElementById('book-calendar');
    if (!node || !url) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setSrc(
          revenueLeakEmbedUrl(url, tracking, {
            fbp: readCookie('_fbp'),
            fbc: readCookie('_fbc'),
          }),
        );
      },
      { rootMargin: '480px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [tracking, url]);

  if (!url) {
    return (
      <Panel className="p-5 text-left">
        <p className="text-sm font-medium text-white">{REVENUE_LEAK.booking.pending}</p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          Set these questions inside iClosed. This page only embeds the calendar and passes the ad tracking through.
        </p>
        <ul className="mt-4 space-y-3 text-sm text-neutral-300">
          {REVENUE_LEAK.booking.questions.map((question) => (
            <li key={question.label}>
              <p className="font-medium text-white">{question.label}</p>
              {'options' in question && question.options ? (
                <p className="mt-1 text-neutral-400">{question.options.join(', ')}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
    );
  }

  return (
    <div id="book-calendar" className="min-h-80">
      {src ? (
        <IclosedEmbed
          url={src}
          title={REVENUE_LEAK.booking.widgetTitle}
          contentName="Revenue Leak Audit"
          eventName={REVENUE_LEAK.booking.event}
          shell={false}
          className="mt-0 max-w-none"
          onBooked={onBooked}
        />
      ) : (
        <div className="panel h-80 rounded-2xl" aria-hidden />
      )}
    </div>
  );
}
