'use client';

import { useEffect, useRef, type ComponentType, type CSSProperties } from 'react';
import Script from 'next/script';

type WistiaProps = {
  mediaId: string;
  aspect?: string;
};

const WistiaPlayer = 'wistia-player' as unknown as ComponentType<{
  'media-id': string;
  aspect?: string;
  style?: CSSProperties;
}>;

export function GoWistia({ mediaId, aspect = '1.7777777777777777' }: WistiaProps) {
  const ratio = Number(aspect);
  const pad = Number.isFinite(ratio) && ratio > 0 ? `${(100 / ratio).toFixed(2)}%` : '56.25%';
  const tracked = useRef(false);

  useEffect(() => {
    const markPlay = () => {
      if (tracked.current) return;
      tracked.current = true;
      const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
      if (typeof fbq === 'function') {
        fbq('track', 'ViewContent', { content_name: 'Cleaning funnel video', content_ids: [mediaId] });
      }
    };

    let bound: Element | null = null;
    const bindPlayer = () => {
      const el = document.querySelector(`wistia-player[media-id='${mediaId}']`);
      if (!el || bound === el) return;
      bound?.removeEventListener('play', markPlay);
      el.addEventListener('play', markPlay);
      bound = el;
    };

    bindPlayer();
    const observer = new MutationObserver(bindPlayer);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      bound?.removeEventListener('play', markPlay);
    };
  }, [mediaId]);

  return (
    <>
      <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />
      <Script src={`https://fast.wistia.com/embed/${mediaId}.js`} strategy="afterInteractive" type="module" />
      <style>{`wistia-player[media-id='${mediaId}']:not(:defined) { background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/${mediaId}/swatch'); display: block; filter: blur(5px); padding-top:${pad}; }`}</style>
      <div className="w-full overflow-hidden bg-black">
        <WistiaPlayer media-id={mediaId} aspect={aspect} style={{ width: '100%', display: 'block' }} />
      </div>
    </>
  );
}
