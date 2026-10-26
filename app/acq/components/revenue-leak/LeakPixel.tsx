'use client';

import { useEffect } from 'react';
import { REVENUE_LEAK_META_PIXEL_ID } from '@/lib/acq/revenue-leak';

type FbqStub = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push: FbqStub;
};

let leakPixelReady = false;
let leakPageViewSent = false;

/** Queue pixel calls until fbevents.js arrives, then init the leak pixel only. */
export function ensureLeakPixel() {
  if (typeof window === 'undefined' || !REVENUE_LEAK_META_PIXEL_ID) return;
  if (!window.fbq) {
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
    if (!document.querySelector('script[src*="connect.facebook.net/en_US/fbevents.js"]')) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
    }
  }
  if (leakPixelReady) return;
  leakPixelReady = true;
  window.fbq('init', REVENUE_LEAK_META_PIXEL_ID);
}

export function LeakPixel() {
  useEffect(() => {
    ensureLeakPixel();
    if (leakPageViewSent || typeof window.fbq !== 'function') return;
    leakPageViewSent = true;
    window.fbq('trackSingle', REVENUE_LEAK_META_PIXEL_ID, 'PageView');
  }, []);

  if (!REVENUE_LEAK_META_PIXEL_ID) return null;

  return (
    <noscript>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        height={1}
        width={1}
        style={{ display: 'none' }}
        src={`https://www.facebook.com/tr?id=${REVENUE_LEAK_META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}
