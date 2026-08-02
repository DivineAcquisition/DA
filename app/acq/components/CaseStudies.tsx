'use client';

import { useEffect, type CSSProperties, type ComponentType } from 'react';
import { eyebrow } from '@/app/components/ui';

const WistiaPlayer = 'wistia-player' as unknown as ComponentType<{
  'media-id': string;
  aspect?: string;
  style?: CSSProperties;
}>;

const CASE_STUDY_SCRIPTS = [
  'https://fast.wistia.com/player.js',
  'https://fast.wistia.com/embed/2a8dvtqmfd.js',
  'https://fast.wistia.com/embed/6p65esjllh.js',
] as const;

type CaseStudy = {
  name: string;
  role: string;
  badge: string;
  quote: string;
  kpis: string[];
  videoId?: string;
  /** `9/16` for vertical source footage inside the uniform 16:9 frame. */
  videoAspect?: '16/9' | '9/16';
};

const CASE_STUDIES: CaseStudy[] = [
  {
    name: 'Nathan',
    role: 'Founder, Home Service Operator',
    badge: 'Live Interview Coming Soon',
    quote:
      "We processed 1,740 bookings and tracked $510K in revenue through Selestial. 32% of our one-time customers converted to recurring service at the booking page, not after weeks of follow-up. That's the number that matters.",
    kpis: ['1,740 Bookings Processed', '$510K Tracked Revenue', '32.3% Recurring Conversion Rate'],
  },
  {
    name: 'Maurisa Alexis Louis',
    role: 'Founder, Home Service Operator',
    badge: 'Live Testimonial',
    quote:
      "We added $50K in new annual revenue from bookings that would've been phone tag before Selestial. Customers see the price, pick their time, and the job's on the calendar before I'd even have called them back.",
    kpis: ['$50K New Annual Revenue', '24/7 Booking Capture', 'Q2 2025 Live Since'],
    videoId: '2a8dvtqmfd',
    videoAspect: '16/9',
  },
  {
    name: 'Will Cole',
    role: 'Owner, Home Service Operator',
    badge: 'Live Testimonial',
    quote:
      "Just want to take the time out to thank Malik for his patience, for just being very resourceful and having a passion for my business as much as I do. And also, with Malik, he's very, very informative and very prompt, and there's nothing that Malik doesn't know when it comes to growing your business.",
    kpis: ['$16K MRR Added in 91 Days', '21 New Bookings', '41% Conversion Rate'],
    videoId: '6p65esjllh',
    videoAspect: '9/16',
  },
];

function CaseStudyVideo({
  videoId,
  videoAspect = '16/9',
}: {
  videoId: string;
  videoAspect?: '16/9' | '9/16';
}) {
  const aspect = videoAspect === '9/16' ? '0.5625' : '1.7777777777777777';

  return (
    <>
      <style>{`wistia-player[media-id='${videoId}']:not(:defined) { background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/${videoId}/swatch'); display: block; filter: blur(5px); width: 100%; height: 100%; }`}</style>
      <div className="relative rounded-2xl bg-gradient-to-br from-brand-400/60 via-brand-500/40 to-brand-600/60 p-[1.5px] shadow-[0_20px_60px_-20px_rgba(154,136,252,0.5)]">
        <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-black">
          <WistiaPlayer
            media-id={videoId}
            aspect={aspect}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      </div>
    </>
  );
}

function CaseStudyCard({ study }: { study: CaseStudy }) {
  return (
    <article className="panel rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-300">
          {study.badge}
        </span>
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-semibold text-white sm:text-xl">{study.name}</h3>
        <p className="mt-1 text-sm text-neutral-500">{study.role}</p>
      </div>

      <div className="mt-5">
        {study.videoId ? (
          <CaseStudyVideo videoId={study.videoId} videoAspect={study.videoAspect} />
        ) : (
          <div className="relative rounded-2xl bg-gradient-to-br from-brand-400/40 via-brand-500/25 to-brand-600/40 p-[1.5px]">
            <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-ink-900">
              <p className="px-4 text-center text-sm font-medium text-neutral-400">
                Live interview coming soon
              </p>
            </div>
          </div>
        )}
      </div>

      <blockquote className="mt-5 text-[15px] leading-relaxed text-neutral-300">
        &ldquo;{study.quote}&rdquo;
      </blockquote>

      <ul className="mt-5 flex flex-wrap gap-2">
        {study.kpis.map((kpi) => (
          <li
            key={kpi}
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-neutral-300"
          >
            {kpi}
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function CaseStudies() {
  useEffect(() => {
    for (const src of CASE_STUDY_SCRIPTS) {
      if (document.querySelector(`script[src="${src}"]`)) continue;
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      if (src.includes('/embed/')) script.type = 'module';
      document.body.appendChild(script);
    }
  }, []);

  return (
    <section className="px-5 pb-16 pt-6 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className={eyebrow}>Real Results</p>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-[2.15rem]">
            Built on Live Revenue. Not Theory.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-neutral-400">
            Real home service company owners running Selestial right now. Here&apos;s what it&apos;s
            doing for them.
          </p>
        </div>

        <div className="mt-10 grid gap-5">
          {CASE_STUDIES.map((study) => (
            <CaseStudyCard key={study.name} study={study} />
          ))}
        </div>
      </div>
    </section>
  );
}
