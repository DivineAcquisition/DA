'use client';

import { useEffect, useRef } from 'react';
import {
  ACQ_CAL_BRAND,
  ACQ_CAL_ELEMENT_ID,
  ACQ_CAL_EMBED_SCRIPT,
  ACQ_CAL_LINK,
  ACQ_CAL_NAMESPACE,
  ACQ_CAL_ORIGIN,
} from '@/lib/acq/config';
import { applyCalIframeHeight, isCalOrigin, readCalIframeHeight } from '@/lib/acq/cal-embed';
import { cn } from '@/lib/utils';
import { CalendarFrame } from './CalendarEmbed';
import { trackPixel } from './MetaPixel';

type CalFn = ((...args: unknown[]) => void) & {
  loaded?: boolean;
  ns?: Record<string, CalFn>;
  q?: unknown[];
  config?: { forwardQueryParams?: boolean };
};

declare global {
  interface Window {
    Cal?: CalFn;
  }
}

/**
 * Official Cal.com stub. Queues commands and injects embed.js once.
 * Kept close to the issued snippet so init / namespace behavior does not drift.
 */
function installCalStub() {
  const C = window;
  const A = ACQ_CAL_EMBED_SCRIPT;
  const L = 'init';
  const p = (api: CalFn, args: unknown[]) => {
    api.q = api.q || [];
    api.q.push(args);
  };

  C.Cal =
    C.Cal ||
    function calStub(...ar: unknown[]) {
      const cal = C.Cal as CalFn;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        C.document.head.appendChild(C.document.createElement('script')).src = A;
        cal.loaded = true;
      }
      if (ar[0] === L) {
        const api = function nsStub(...args: unknown[]) {
          p(api, args);
        } as CalFn;
        const namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === 'string') {
          cal.ns = cal.ns || {};
          cal.ns[namespace] = cal.ns[namespace] || api;
          p(cal.ns[namespace], ar);
          p(cal, ['initNamespace', namespace]);
        } else {
          p(cal, ar);
        }
        return;
      }
      p(cal, ar);
    } as CalFn;
}

function namespaceApi(): CalFn | undefined {
  return window.Cal?.ns?.[ACQ_CAL_NAMESPACE];
}

/** Cal.com month-view calendar. Height follows the iframe content. */
export default function CalEmbed({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pixelFired = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const applyHeight = (height?: number) => applyCalIframeHeight(host, height);

    const observer = new MutationObserver(() => applyHeight());
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });

    const onMessage = (event: MessageEvent) => {
      if (event.origin && event.origin !== window.location.origin && !isCalOrigin(event.origin)) {
        return;
      }
      const height = readCalIframeHeight(event.data);
      if (height) applyHeight(height);
    };
    window.addEventListener('message', onMessage);

    if (host.dataset.calInitialized !== 'true') {
      host.dataset.calInitialized = 'true';
      installCalStub();
      const Cal = window.Cal;
      if (Cal) {
        Cal('init', ACQ_CAL_NAMESPACE, { origin: ACQ_CAL_ORIGIN });
        Cal.config = Cal.config || {};
        Cal.config.forwardQueryParams = true;

        const ns = namespaceApi();
        ns?.('inline', {
          elementOrSelector: `#${ACQ_CAL_ELEMENT_ID}`,
          config: {
            layout: 'month_view',
            useSlotsViewOnSmallScreen: 'true',
            theme: 'dark',
          },
          calLink: ACQ_CAL_LINK,
        });
        ns?.('ui', {
          theme: 'dark',
          cssVarsPerTheme: { dark: { 'cal-brand': ACQ_CAL_BRAND } },
          hideEventTypeDetails: false,
          layout: 'month_view',
        });
      }
    }

    const ns = namespaceApi();
    ns?.('on', {
      action: '__dimensionChanged',
      callback: (event: unknown) => {
        const height = readCalIframeHeight(event);
        if (height) applyHeight(height);
      },
    });
    ns?.('on', {
      action: 'bookingSuccessful',
      callback: () => {
        if (pixelFired.current) return;
        pixelFired.current = true;
        trackPixel('Schedule');
      },
    });

    applyHeight();

    return () => {
      observer.disconnect();
      window.removeEventListener('message', onMessage);
    };
  }, []);

  return (
    <CalendarFrame className={cn('w-full max-w-7xl', className)}>
      <div ref={hostRef} id={ACQ_CAL_ELEMENT_ID} className="acq-cal-embed" />
    </CalendarFrame>
  );
}
