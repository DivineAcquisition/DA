'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Script from 'next/script';
import { BorderBeam } from '@/components/ui/border-beam';
import {
  ACQ_CALENDAR_EMBED_SCRIPT,
  ACQ_CALENDAR_EMBED_URL,
  ACQ_CALENDAR_IFRAME_ID,
} from '@/lib/acq/config';
import { THANK_YOU_CALENDAR_PENDING } from '@/lib/acq/copy';
import { cn } from '@/lib/utils';
import { trackPixel } from './MetaPixel';

function isGhlOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return (
      host.endsWith('leadconnectorhq.com') ||
      host.endsWith('msgsndr.com') ||
      host.endsWith('gohighlevel.com') ||
      host === 'link.msgsndr.divineacquisition.io' ||
      host.endsWith('.msgsndr.divineacquisition.io')
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
      (value.includes('complete') ||
        value.includes('created') ||
        value.includes('success') ||
        value.includes('booked')),
  );
}

export function CalendarFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('animate-rise delay-2 relative mx-auto mt-10 w-full max-w-4xl', className)}>
      <div
        aria-hidden
        className="absolute inset-x-6 -bottom-6 top-8 rounded-[2rem] opacity-70 blur-2xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(154,136,252,0.35) 0%, transparent 70%)',
        }}
      />
      <div className="panel relative overflow-hidden rounded-3xl p-1.5 sm:p-2">
        <BorderBeam size={80} duration={8} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} />
        <div className="w-full overflow-hidden rounded-[1.25rem] bg-black">{children}</div>
      </div>
    </div>
  );
}

/** GHL booking calendar. Visible on /thank-you; fires Schedule on book. */
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
      <CalendarFrame>
        <div className="px-5 py-16 text-center sm:px-8">
          <p className="text-sm leading-relaxed text-neutral-400">{THANK_YOU_CALENDAR_PENDING}</p>
        </div>
      </CalendarFrame>
    );
  }

  return (
    <CalendarFrame>
      <iframe
        id={ACQ_CALENDAR_IFRAME_ID}
        src={src}
        title="Free sales audit"
        allow="payment"
        className="h-[680px] w-full border-0 bg-black sm:h-[720px]"
        scrolling="no"
      />
      <Script src={ACQ_CALENDAR_EMBED_SCRIPT} strategy="afterInteractive" />
    </CalendarFrame>
  );
}
