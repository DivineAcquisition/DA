'use client';

import { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { REVENUE_LEAK } from '@/lib/acq/revenue-leak-content';
import { vslEmbed } from '@/lib/acq/revenue-leak';
import { trackPixel } from '../MetaPixel';

export function VslPlayer() {
  const [started, setStarted] = useState(false);
  const tracked = useRef(false);
  const embed = vslEmbed(REVENUE_LEAK.video.url);
  const ready = embed.kind !== 'empty';

  function play() {
    if (!ready) return;
    setStarted(true);
    if (tracked.current) return;
    tracked.current = true;
    trackPixel('ViewContent', {
      content_name: 'Revenue Leak Audit VSL',
      content_category: 'local-service',
    });
  }

  return (
    <figure className="mt-6 w-full text-center">
      <div className="panel relative aspect-video overflow-hidden rounded-2xl bg-ink-900">
        {started && embed.kind === 'iframe' ? (
          <iframe
            className="absolute inset-0 h-full w-full border-0"
            src={embed.src}
            title={REVENUE_LEAK.hero.videoCaption}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : null}
        {started && embed.kind === 'video' ? (
          <video className="absolute inset-0 h-full w-full" src={embed.src} controls autoPlay playsInline />
        ) : null}
        {started ? null : (
          <button
            type="button"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-brand-300"
            onClick={play}
            aria-disabled={ready ? undefined : true}
            aria-label={ready ? REVENUE_LEAK.hero.videoCaption : REVENUE_LEAK.hero.videoPending}
          >
            {REVENUE_LEAK.video.poster ? (
              // Poster is a content-file URL. The frame already reserves the 16:9 box.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={REVENUE_LEAK.video.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(154, 136, 252, 0.28), transparent 62%), linear-gradient(180deg, #16151f, #07070b)',
                }}
              />
            )}
            <span className="relative flex size-14 items-center justify-center rounded-full bg-brand-500 text-ink-950 shadow-[0_12px_28px_-12px_rgba(102,80,216,0.9)]">
              <Play className="ml-0.5 size-6 fill-current" aria-hidden />
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-3 text-sm text-neutral-400">{REVENUE_LEAK.hero.videoCaption}</figcaption>
      {ready ? null : <p className="mt-1 text-xs text-neutral-500">{REVENUE_LEAK.hero.videoPending}</p>}
    </figure>
  );
}
