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

function isDesktopCalendar(): boolean {
  return window.matchMedia('(min-width: 640px)').matches;
}

/** Desktop floor so the details column can show the full event copy. */
const DESKTOP_HEIGHT_FLOOR = 736;

function readIframeHeight(event: unknown): number | null {
  if (!event || typeof event !== 'object') return null;
  const record = event as Record<string, unknown>;
  const detail = record.detail;
  const nested =
    detail && typeof detail === 'object'
      ? ((detail as Record<string, unknown>).data ?? detail)
      : (record.data ?? record);
  if (!nested || typeof nested !== 'object') return null;
  const height = (nested as Record<string, unknown>).iframeHeight;
  return typeof height === 'number' && Number.isFinite(height) && height > 0
    ? Math.ceil(height)
    : null;
}

function syncIframeHeight(host: HTMLElement, reported?: number) {
  const iframe = host.querySelector('iframe');
  if (!(iframe instanceof HTMLIFrameElement)) return;

  const current = parseFloat(iframe.style.height);
  const base = reported ?? (Number.isFinite(current) ? current : 0);
  if (!base) return;

  const desktop = isDesktopCalendar();
  const next = Math.max(Math.ceil(base), desktop ? DESKTOP_HEIGHT_FLOOR : 0);
  if (!Number.isFinite(current) || Math.abs(current - next) >= 1) {
    iframe.style.height = `${next}px`;
  }

  // Mobile may shrink; desktop keeps the CSS floor via the iframe height.
  host.style.minHeight = desktop ? '' : '0px';
  host.dataset.calSized = 'true';
}

/** Cal.com month-view calendar for /book. Height follows the iframe content. */
export default function CalEmbed() {
  const pixelFired = useRef(false);

  useEffect(() => {
    const host = document.getElementById(ACQ_CAL_ELEMENT_ID);
    if (!host) return;

    const sync = (reported?: number) => {
      syncIframeHeight(host, reported);
    };

    const observer = new MutationObserver(() => sync());
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });

    if (host.dataset.calInitialized === 'true') {
      sync();
      return () => observer.disconnect();
    }
    host.dataset.calInitialized = 'true';

    installCalStub();
    const Cal = window.Cal;
    if (!Cal) return () => observer.disconnect();

    Cal('init', ACQ_CAL_NAMESPACE, { origin: ACQ_CAL_ORIGIN });
    Cal.config = Cal.config || {};
    Cal.config.forwardQueryParams = true;

    const ns = Cal.ns?.[ACQ_CAL_NAMESPACE];
    if (!ns) return () => observer.disconnect();

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
      action: '__dimensionChanged',
      callback: (event: unknown) => {
        const height = readIframeHeight(event);
        if (height) sync(height);
      },
    });

    ns('on', {
      action: 'bookingSuccessful',
      callback: () => {
        if (pixelFired.current) return;
        pixelFired.current = true;
        trackPixel('Schedule');
      },
    });

    return () => observer.disconnect();
  }, []);

  return (
    <CalendarFrame className="max-w-5xl">
      <div
        id={ACQ_CAL_ELEMENT_ID}
        className={cn(
          'w-full min-h-[32rem] overflow-visible bg-black sm:min-h-[46rem]',
          '[&_iframe]:block [&_iframe]:w-full [&_iframe]:border-0',
        )}
      />
    </CalendarFrame>
  );
}
