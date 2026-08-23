'use client';

import Script from 'next/script';
import { ACQ_META_PIXEL_ID } from '@/lib/acq/config';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export function trackPixel(event: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !ACQ_META_PIXEL_ID || typeof window.fbq !== 'function') {
    return;
  }
  if (params) window.fbq('track', event, params);
  else window.fbq('track', event);
}

export function MetaPixel() {
  const pixelId = ACQ_META_PIXEL_ID;
  if (!pixelId) return null;

  return (
    <>
      <Script id="acq-meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* Meta requires this 1×1 pixel; next/image cannot serve it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height={1}
          width={1}
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

/**
 * @deprecated Lead now fires client-side after /api/submit-lead succeeds,
 * before the thank-you redirect. Kept as a no-op so old imports compile.
 */
export function ThankYouConversion() {
  return null;
}
