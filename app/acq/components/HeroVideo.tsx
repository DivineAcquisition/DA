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
 * Official Wistia iframe. The previous <wistia-player> custom element never
 * defined on the live acq host, so the hero rendered as empty space.
 * An iframe plus a reserved aspect box always occupies space and plays.
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
      <div className="mx-auto w-full max-w-[1040px]">
        <div className="flex aspect-video items-center justify-center rounded-2xl border border-white/10 bg-ink-900">
          <span className="text-xs text-neutral-600">Video unavailable</span>
        </div>
      </div>
    );
  }

  const embedSrc = `https://fast.wistia.net/embed/iframe/${mediaId}?seo=true&videoFoam=true&playerColor=9A88FC`;
  const swatch = `https://fast.wistia.com/embed/medias/${mediaId}/swatch`;

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <Script src="https://fast.wistia.com/assets/external/E-v1.js" strategy="afterInteractive" />
      <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />

      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 rounded-[2rem] sm:-inset-10"
          style={{
            background:
              'radial-gradient(ellipse at 50% 40%, rgba(154,136,252,0.22) 0%, rgba(154,136,252,0.06) 42%, transparent 70%)',
            filter: 'blur(28px)',
          }}
        />

        <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-ink-900 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.9)]">
          <div className="flex items-center gap-3 border-b border-white/[0.06] bg-ink-850 px-3.5 py-2.5">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-white/20" />
              <span className="h-2 w-2 rounded-full bg-white/12" />
              <span className="h-2 w-2 rounded-full bg-white/12" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-neutral-500">
              Divine Acquisition · Sales operations
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-neutral-500 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              VSL
            </span>
          </div>

          <div
            className="relative w-full bg-black"
            style={{
              aspectRatio: ACQ_WISTIA_ASPECT,
              background: `center / cover no-repeat url('${swatch}')`,
            }}
          >
            <iframe
              src={embedSrc}
              title={VSL_TITLE}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              name="wistia_embed"
              className="wistia_embed absolute inset-0 h-full w-full border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
