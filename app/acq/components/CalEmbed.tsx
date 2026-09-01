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

/** Cal.com month-view calendar for /book. Fires Schedule on a successful booking. */
export default function CalEmbed() {
  const pixelFired = useRef(false);

  useEffect(() => {
    const host = document.getElementById(ACQ_CAL_ELEMENT_ID);
    if (!host || host.dataset.calInitialized === 'true') return;
    host.dataset.calInitialized = 'true';

    installCalStub();
    const Cal = window.Cal;
    if (!Cal) return;

    Cal('init', ACQ_CAL_NAMESPACE, { origin: ACQ_CAL_ORIGIN });
    Cal.config = Cal.config || {};
    Cal.config.forwardQueryParams = true;

    const ns = Cal.ns?.[ACQ_CAL_NAMESPACE];
    if (!ns) return;

    ns('inline', {
      elementOrSelector: `#${ACQ_CAL_ELEMENT_ID}`,
      config: {
        layout: 'month_view',
        useSlotsViewOnSmallScreen: 'true',
        theme: 'dark',
      },
      calLink: ACQ_CAL_LINK,
    });

    ns('ui', {
      theme: 'dark',
      cssVarsPerTheme: { dark: { 'cal-brand': ACQ_CAL_BRAND } },
      hideEventTypeDetails: false,
      layout: 'month_view',
    });

    ns('on', {
      action: 'bookingSuccessful',
      callback: () => {
        if (pixelFired.current) return;
        pixelFired.current = true;
        trackPixel('Schedule');
      },
    });
  }, []);

  return (
    <CalendarFrame>
      <div className="h-[780px] w-full sm:h-[900px]">
        <div
          id={ACQ_CAL_ELEMENT_ID}
          className="h-full w-full overflow-auto bg-black"
        />
      </div>
    </CalendarFrame>
  );
}
