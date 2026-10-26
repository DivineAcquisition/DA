'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import {
  ACQ_ICLOSED_EMBED_SCRIPT,
  ACQ_ICLOSED_EVENT_URL,
  ACQ_ICLOSED_HEIGHT,
  ACQ_ICLOSED_TITLE,
} from '@/lib/acq/config';
import { cn } from '@/lib/utils';
import { CalendarFrame } from './CalendarEmbed';
import { trackPixel } from './MetaPixel';

function isIclosedOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'app.iclosed.io' || host.endsWith('.iclosed.io');
  } catch {
    return false;
  }
}

function looksLikeBooking(data: unknown): boolean {
  if (data == null) return false;
  if (typeof data === 'string') {
    const text = data.toLowerCase();
    return (
      (text.includes('book') || text.includes('schedul') || text.includes('appointment')) &&
      (text.includes('success') || text.includes('complete') || text.includes('confirm'))
    );
  }
  if (typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  const tokens = [record.type, record.event, record.action, record.name, record.status]
    .filter((value) => typeof value === 'string')
    .map((value) => String(value).toLowerCase());
  return tokens.some(
    (value) =>
      (value.includes('book') || value.includes('schedul') || value.includes('appointment')) &&
      (value.includes('success') ||
        value.includes('complete') ||
        value.includes('confirm') ||
        value.includes('created')),
  );
}

function readPostedHeight(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const nested =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : record;
  const height = nested.height ?? nested.iframeHeight ?? record.height;
  return typeof height === 'number' && Number.isFinite(height) && height > 0
    ? Math.ceil(height)
    : null;
}

type IclosedEmbedProps = {
  url?: string;
  title?: string;
  contentName?: string;
  eventName?: 'Schedule' | 'Lead';
  shell?: boolean;
  className?: string;
  onBooked?: (eventId: string, eventName: 'Schedule' | 'Lead') => void;
};

/** iClosed inline scheduler. The coaches calendar stays the default URL. */
export default function IclosedEmbed({
  url = ACQ_ICLOSED_EVENT_URL,
  title = ACQ_ICLOSED_TITLE,
  contentName,
  eventName,
  shell = true,
  className,
  onBooked,
}: IclosedEmbedProps = {}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pixelFired = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const followIframeHeight = () => {
      const iframe = host.querySelector('iframe');
      if (!(iframe instanceof HTMLIFrameElement)) return;
      const height = parseFloat(iframe.style.height);
      if (!Number.isFinite(height) || height <= 0) return;
      host.style.height = `${Math.max(height, ACQ_ICLOSED_HEIGHT)}px`;
    };

    const observer = new MutationObserver(followIframeHeight);
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });

    const onMessage = (event: MessageEvent) => {
      if (event.origin && event.origin !== window.location.origin && !isIclosedOrigin(event.origin)) {
        return;
      }

      const postedHeight = readPostedHeight(event.data);
      if (postedHeight) {
        host.style.height = `${Math.max(postedHeight, ACQ_ICLOSED_HEIGHT)}px`;
        const iframe = host.querySelector('iframe');
        if (iframe instanceof HTMLIFrameElement) {
          iframe.style.height = `${postedHeight}px`;
        }
      }

      if (pixelFired.current) return;
      if (!looksLikeBooking(event.data)) return;
      pixelFired.current = true;
      if (eventName || contentName) {
        const booked = eventName ?? 'Schedule';
        const eventId = crypto.randomUUID();
        trackPixel(
          booked,
          { content_name: contentName || 'Booking', content_category: 'local-service' },
          eventId,
        );
        onBooked?.(eventId, booked);
        return;
      }
      trackPixel('Schedule');
    };

    window.addEventListener('message', onMessage);
    return () => {
      observer.disconnect();
      window.removeEventListener('message', onMessage);
    };
  }, [contentName, eventName, onBooked]);

  return (
    <CalendarFrame shell={shell} className={shell ? cn('max-w-5xl', className) : cn('mt-0 max-w-none', className)}>
      <div
        ref={hostRef}
        className="iclosed-widget w-full bg-black [&_iframe]:block [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0"
        data-url={url}
        title={title}
        style={{ width: '100%', height: ACQ_ICLOSED_HEIGHT }}
      />
      <Script src={ACQ_ICLOSED_EMBED_SCRIPT} strategy="afterInteractive" />
    </CalendarFrame>
  );
}
