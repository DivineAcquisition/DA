'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import { ACQ_META_PIXEL_ID, ACQ_WISTIA_ASPECT, ACQ_WISTIA_MEDIA_ID } from '@/lib/acq/config';
import { trackPixel } from './MetaPixel';

declare global {
  interface Window {
    _wq?: Array<Record<string, unknown>>;
  }
}

const VSL_TITLE = 'Fix Sales Operations Bottlenecks With AI';

/**
 * Official Wistia iframe embed. The previous <wistia-player> custom element
 * did not paint on the live acq host, so the VSL was missing. Iframe + a
 * reserved aspect box always occupies space and plays.
 */
export default function HeroVideo() {
  const mediaId = ACQ_WISTIA_MEDIA_ID;
  const tracked = useRef(false);

  useEffect(() => {
    if (!mediaId) return;

    let attempts = 0;
    const markPlay = () => {
      if (tracked.current || !ACQ_META_PIXEL_ID) return;
      if (typeof window.fbq !== 'function') {
        if (attempts < 8) {
          attempts += 1;
          window.setTimeout(markPlay, 250);
        }
        return;
      }
      tracked.current = true;
      trackPixel('ViewContent', { content_name: 'Founding Install VSL', content_ids: [mediaId] });
    };

    window._wq = window._wq || [];
    window._wq.push({
      id: mediaId,
      onReady(video: { bind?: (event: string, fn: () => void) => void }) {
        video.bind?.('play', markPlay);
      },
    });
  }, [mediaId]);

  if (!mediaId) {
    return (
      <div className="mx-auto w-full max-w-[880px]">
        <div className="flex aspect-video items-center justify-center rounded-2xl border border-white/10 bg-ink-900">
          <span className="text-xs text-neutral-600">Video unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-rise delay-3 mx-auto w-full max-w-[880px]">
      <Script src="https://fast.wistia.com/assets/external/E-v1.js" strategy="afterInteractive" />
      <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />

      <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-ink-900 shadow-[0_28px_80px_-36px_rgba(0,0,0,0.85)]">
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-ink-850 px-3.5 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-white/18" />
            <span className="h-2 w-2 rounded-full bg-white/12" />
            <span className="h-2 w-2 rounded-full bg-white/12" />
          </span>
          <span className="min-w-0 truncate text-[11px] font-medium text-neutral-500">
            Divine Acquisition · Sales operations
          </span>
        </div>

        <div
          className="relative w-full bg-black"
          style={{
            aspectRatio: ACQ_WISTIA_ASPECT,
            background: `center / cover no-repeat url('https://fast.wistia.com/embed/medias/${mediaId}/swatch')`,
          }}
        >
          <iframe
            src={`https://fast.wistia.net/embed/iframe/${mediaId}?seo=true&videoFoam=true&playerColor=9A88FC`}
            title={VSL_TITLE}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
