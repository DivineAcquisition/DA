import Logo from '@/app/components/Logo';
import { sectionLabel } from '@/app/components/ui';
import type { Metadata } from 'next';
import { acqCalendarEmbedSrc, trackingFromSearchParams, type SearchParams } from '@/lib/acq/config';
import { PRACTICES } from '@/lib/acq/copy';
import { CalendarEmbed } from '../components/CalendarEmbed';
import PracticesBackdrop from '../components/PracticesBackdrop';
import PracticesFounder from '../components/PracticesFounder';
import { BookCta, IncludedCards, StatusPill } from '../components/marketing';

export const metadata: Metadata = {
  title: { absolute: "We'll Run Your Meta Ads | Divine Acquisition" },
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
  const tracking = trackingFromSearchParams(query);

  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <PracticesBackdrop />

      <div className="relative z-10">
        <header className="relative z-10 px-5 pt-6 sm:px-6 sm:pt-8">
          <div className="mx-auto flex max-w-5xl flex-col items-center">
            <Logo className="h-[20px] w-auto sm:h-[24px]" title="Divine Acquisition" />
            <div className="acq-headline animate-rise mt-6">
              <StatusPill variant="solid">{PRACTICES.pill}</StatusPill>
            </div>
          </div>
        </header>

        <section className="relative z-10 px-5 pb-6 pt-8 sm:px-6 sm:pb-8 sm:pt-10 md:pt-12">
          <div className="mx-auto max-w-[900px] text-center">
            <h1 className="acq-headline animate-rise delay-1 mx-auto max-w-[920px] text-[1.45rem] font-bold leading-[1.16] tracking-tight text-balance text-white sm:text-[2.05rem] md:text-[2.4rem] md:leading-[1.12]">
              {PRACTICES.titleBefore}
              <em className="acq-headline-accent">{PRACTICES.titleAccent}</em>
              {PRACTICES.titleAfter}
            </h1>
            <p className="animate-rise delay-2 mx-auto mt-5 max-w-[36rem] text-sm font-semibold leading-relaxed text-neutral-300 sm:mt-6 sm:text-[15px]">
              {PRACTICES.body}
            </p>
          </div>
        </section>

        <section id="book" className="scroll-mt-8 px-3 pb-12 sm:px-6 sm:pb-14 lg:px-8">
          <CalendarEmbed
            src={acqCalendarEmbedSrc(tracking)}
            title={PRACTICES.calendarTitle}
            className="mt-0"
          />
          <p className="acq-headline mt-6 text-center text-sm font-semibold tracking-tight text-neutral-200 sm:text-base">
            {PRACTICES.calendarNote}
          </p>
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <PracticesFounder />
          </div>
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <p className={sectionLabel}>{PRACTICES.coversEyebrow}</p>
            <h2 className="acq-headline mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
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
          <p className="mx-auto max-w-2xl text-[11px] font-semibold leading-relaxed text-neutral-500 sm:text-xs">
            {PRACTICES.compliance}
          </p>
        </footer>
      </div>
    </div>
  );
}
