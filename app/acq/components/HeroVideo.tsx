'use client';

import { useEffect, useRef, type ComponentType, type CSSProperties } from 'react';
import Script from 'next/script';
import { ACQ_META_PIXEL_ID, ACQ_WISTIA_ASPECT, ACQ_WISTIA_MEDIA_ID } from '@/lib/acq/config';
import { trackPixel } from './MetaPixel';

const WistiaPlayer = 'wistia-player' as unknown as ComponentType<{
  'media-id': string;
  aspect?: string;
  style?: CSSProperties;
}>;

declare global {
  interface Window {
    _wq?: Array<Record<string, unknown>>;
  }
}

/**
 * Hero VSL. Same Wistia embed as before. Fires ViewContent once on first play
 * so Meta can optimize toward people who actually watched.
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

    let bound: Element | null = null;
    const bindPlayer = () => {
      const el = document.querySelector('wistia-player');
      if (!el || bound === el) return;
      bound?.removeEventListener('play', markPlay);
      el.addEventListener('play', markPlay);
      bound = el;
    };

    window._wq = window._wq || [];
    window._wq.push({
      id: mediaId,
      onReady(video: { bind?: (event: string, fn: () => void) => void }) {
        video.bind?.('play', markPlay);
      },
    });

    bindPlayer();
    const observer = new MutationObserver(bindPlayer);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      bound?.removeEventListener('play', markPlay);
    };
  }, [mediaId]);

  return (
    <div className="animate-rise delay-3 relative mx-auto max-w-4xl">
      {mediaId ? (
        <>
          <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />
          <Script
            src={`https://fast.wistia.com/embed/${mediaId}.js`}
            strategy="afterInteractive"
            type="module"
          />
        </>
      ) : null}

      <div
        aria-hidden
        className="absolute inset-x-6 -bottom-6 top-8 rounded-[2rem] opacity-70 blur-2xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(154,136,252,0.35) 0%, transparent 70%)',
        }}
      />

      <div className="panel relative overflow-hidden rounded-3xl p-1.5 sm:p-2">
        <div className="overflow-hidden rounded-[1.25rem] bg-black">
          {mediaId ? (
            <WistiaPlayer media-id={mediaId} aspect={ACQ_WISTIA_ASPECT} />
          ) : (
            <div
              className="flex aspect-video w-full items-center justify-center bg-ink-900"
              role="img"
              aria-label="Video placeholder"
            >
              <span className="text-xs text-neutral-600">Video unavailable</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
