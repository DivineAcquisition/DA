'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import { ACQ_CALENDAR_EMBED_URL } from '@/lib/acq/config';
import { THANK_YOU_CALENDAR_PENDING } from '@/lib/acq/copy';
import { trackPixel } from './MetaPixel';

function isGhlOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return (
      host.endsWith('leadconnectorhq.com') ||
      host.endsWith('msgsndr.com') ||
      host.endsWith('gohighlevel.com')
    );
  } catch {
    return false;
  }
}

function looksLikeBooking(data: unknown): boolean {
  if (data == null) return false;
  if (typeof data === 'string') {
    const text = data.toLowerCase();
    return (
      text.includes('booking') &&
      (text.includes('complete') || text.includes('created') || text.includes('success'))
    );
  }
  if (typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  const tokens = [record.type, record.event, record.action, record.name, record.status]
    .filter((value) => typeof value === 'string')
    .map((value) => String(value).toLowerCase());
  return tokens.some(
    (value) =>
      (value.includes('booking') || value.includes('appointment')) &&
      (value.includes('complete') || value.includes('created') || value.includes('success') || value.includes('booked')),
  );
}

/** GHL Lead Leak Audit calendar. Visible for every applicant; fires Schedule on book. */
export function CalendarEmbed() {
  const fired = useRef(false);
  const src = ACQ_CALENDAR_EMBED_URL;

  useEffect(() => {
    if (!src) return;

    const onMessage = (event: MessageEvent) => {
      if (fired.current) return;
      if (event.origin && event.origin !== window.location.origin && !isGhlOrigin(event.origin)) {
        return;
      }
      if (!looksLikeBooking(event.data)) return;
      fired.current = true;
      trackPixel('Schedule');
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [src]);

  if (!src) {
    return (
      <div className="panel mt-10 rounded-3xl px-5 py-10 text-center sm:px-8">
        <p className="text-sm leading-relaxed text-neutral-400">{THANK_YOU_CALENDAR_PENDING}</p>
      </div>
    );
  }

  return (
    <div className="panel mt-10 overflow-hidden rounded-3xl p-1.5 sm:p-2">
      <Script src="https://link.msgsndr.com/js/form_embed.js" strategy="afterInteractive" />
      <iframe
        src={src}
        title="Lead Leak Audit (30 min)"
        className="h-[680px] w-full rounded-[1.15rem] border-0 bg-ink-900 sm:h-[720px]"
        scrolling="no"
      />
    </div>
  );
}
