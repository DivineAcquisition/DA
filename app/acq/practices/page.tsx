import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { sectionLabel } from '@/app/components/ui';
import { Particles } from '@/components/ui/particles';
import type { Metadata } from 'next';
import {
  acqCalendarEmbedSrc,
  trackingFromSearchParams,
  type SearchParams,
} from '@/lib/acq/config';
import { FACEBOOK_DISCLAIMER, PRACTICES } from '@/lib/acq/copy';
import { CalendarEmbed } from '../components/CalendarEmbed';
import { BookCta, IncludedCards, StatusPill } from '../components/marketing';

export const metadata: Metadata = {
  title: { absolute: 'Book more patients | Divine Acquisition' },
  description: PRACTICES.body,
  alternates: {
    canonical: 'https://acq.divineacquisition.io/practices',
  },
  openGraph: {
    title: PRACTICES.title,
    description: PRACTICES.body,
    url: 'https://acq.divineacquisition.io/practices',
    siteName: 'Divine Acquisition',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Divine Acquisition',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: PRACTICES.title,
    description: PRACTICES.body,
  },
};

export default async function PracticesLandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const calendarSrc = acqCalendarEmbedSrc(trackingFromSearchParams(query));

  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />

      <div className="relative z-10">
        <div className="relative overflow-hidden">
          <Particles
            className="absolute inset-0 z-0"
            quantity={48}
            color="#9A88FC"
            ease={80}
            size={0.5}
          />
          <header className="relative z-10 px-5 pt-6 sm:px-6 sm:pt-8">
            <div className="mx-auto flex max-w-5xl flex-col items-center">
              <Logo className="h-[20px] w-auto sm:h-[24px]" title="Divine Acquisition" />
              <div className="acq-headline animate-rise mt-6">
                <StatusPill>{PRACTICES.pill}</StatusPill>
              </div>
            </div>
          </header>

          <section className="relative z-10 px-5 pb-6 pt-8 sm:px-6 sm:pb-8 sm:pt-10 md:pt-12">
            <div className="mx-auto max-w-[900px] text-center">
              <h1 className="acq-headline animate-rise delay-1 mx-auto max-w-[34rem] text-[1.65rem] font-semibold leading-[1.14] tracking-tight text-white sm:text-[2.2rem] md:text-[2.55rem] md:leading-[1.1]">
                {PRACTICES.titleBefore}
                <em className="acq-headline-accent">{PRACTICES.titleAccent}</em>
              </h1>
              <p className="animate-rise delay-2 mx-auto mt-5 max-w-[34rem] text-sm leading-relaxed text-neutral-400 sm:mt-6 sm:text-[15px]">
                {PRACTICES.body}
              </p>
            </div>
          </section>
        </div>

        <section id="book" className="scroll-mt-8 px-5 pb-16 sm:px-6 sm:pb-20">
          <CalendarEmbed
            src={calendarSrc}
            title={PRACTICES.calendarTitle}
            className="mt-0 max-w-4xl"
            iframeClassName="h-[920px] sm:h-[980px]"
          />
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <p className={sectionLabel}>{PRACTICES.coversEyebrow}</p>
            <h2 className="acq-headline mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {PRACTICES.coversTitle}
            </h2>
            <IncludedCards items={PRACTICES.covers} />
            <div className="mt-10 flex justify-center">
              <BookCta href="#book" className="max-w-sm">
                {PRACTICES.cta}
              </BookCta>
            </div>
          </div>
        </section>

        <footer className="hairline-glow relative border-t border-white/[0.06] px-5 py-10 text-center sm:px-6">
          <p className="text-xs text-neutral-600">© Divine Acquisition. All rights reserved.</p>
          <p className="mx-auto mt-5 max-w-2xl text-[10px] leading-relaxed text-neutral-600 sm:text-[11px]">
            {FACEBOOK_DISCLAIMER}
          </p>
        </footer>
      </div>
    </div>
  );
}
