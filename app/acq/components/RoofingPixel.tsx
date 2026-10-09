'use client';

import { useEffect } from 'react';
import { ROOFING_META_PIXEL_ID } from '@/lib/acq/roofing-pixel';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

type FbqStub = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push: FbqStub;
};

function installFbq() {
  if (window.fbq) return;
  const queue: unknown[] = [];
  const fbq = function fbqStub(this: FbqStub, ...args: unknown[]) {
    if (typeof fbq.callMethod === 'function') Reflect.apply(fbq.callMethod, fbq, args);
    else queue.push(args);
  } as FbqStub;
  fbq.queue = queue;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.push = fbq;
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;
  if (document.querySelector('script[src*="connect.facebook.net/en_US/fbevents.js"]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);
}

export function readBrowserCookie(name: string): string | undefined {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return match.slice(name.length + 1);
  }
}

export function browserClickIds(): { fbp?: string; fbc?: string } {
  return { fbp: readBrowserCookie('_fbp'), fbc: readBrowserCookie('_fbc') };
}

/** Sends one event to the roofing pixel only, with the id the server event uses. */
export function trackRoofingBrowser(event: string, eventId: string, custom = false, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !ROOFING_META_PIXEL_ID) return;
  installFbq();
  window.fbq?.('init', ROOFING_META_PIXEL_ID);
  window.fbq?.(
    custom ? 'trackSingleCustom' : 'trackSingle',
    ROOFING_META_PIXEL_ID,
    event,
    params ?? { content_name: 'Lead Leak Audit' },
    { eventID: eventId },
  );
}

export function RoofingPixel() {
  useEffect(() => {
    document.cookie = 'da_pixel=roofing; Path=/; Max-Age=2592000; SameSite=Lax';
    const eventId = crypto.randomUUID();
    trackRoofingBrowser('PageView', eventId, false, {});
    const ids = browserClickIds();
    const fbclid = new URLSearchParams(window.location.search).get('fbclid') || undefined;
    fetch('/api/meta/capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        eventName: 'PageView',
        eventId,
        eventSourceUrl: window.location.href,
        fbp: ids.fbp,
        fbc: ids.fbc,
        fbclid,
      }),
    }).catch(() => {
      // The browser pixel already fired. A blocked request just skips the server copy.
    });
  }, []);

  if (!ROOFING_META_PIXEL_ID) return null;

  return (
    <noscript>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        height={1}
        width={1}
        style={{ display: 'none' }}
        src={`https://www.facebook.com/tr?id=${ROOFING_META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}
