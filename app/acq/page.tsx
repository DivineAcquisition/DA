import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { sectionLabel } from '@/app/components/ui';
import { Particles } from '@/components/ui/particles';
import { Marquee } from '@/components/ui/marquee';
import {
  acqApplyUrl,
  trackingFromSearchParams,
  type SearchParams,
} from '@/lib/acq/config';
import {
  FACEBOOK_DISCLAIMER,
  FOUNDING_OFFER,
  HEADLINE_ACCENT,
  HEADLINE_AFTER,
  HEADLINE_BEFORE,
  INCLUDED,
  INCLUDED_FOOTNOTE,
  INCLUDED_HEADLINE,
  PILL_BANNER,
  SUBHEADLINE,
} from '@/lib/acq/copy';
import HeroVideo from './components/HeroVideo';
import {
  BookCta,
  IncludedCards,
  StatusPill,
} from './components/marketing';

export default async function AcqLandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const applyHref = acqApplyUrl(trackingFromSearchParams(query));

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
                <StatusPill>{PILL_BANNER}</StatusPill>
              </div>
            </div>
          </header>

          <section className="relative z-10 px-5 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-10 md:pt-12">
            <div className="mx-auto max-w-[900px] text-center">
              <h1 className="acq-headline animate-rise delay-1 mx-auto max-w-[920px] text-[1.45rem] font-semibold leading-[1.16] tracking-tight text-white sm:text-[2.05rem] md:text-[2.4rem] md:leading-[1.12]">
                {HEADLINE_BEFORE}
                <em className="acq-headline-accent">{HEADLINE_ACCENT}</em>
                {HEADLINE_AFTER}
              </h1>

              <p className="animate-rise delay-2 mx-auto mt-4 max-w-[34rem] text-sm leading-relaxed text-neutral-400 sm:mt-5 sm:text-[15px]">
                {SUBHEADLINE}
              </p>
            </div>
          </section>
        </div>

        <section className="px-5 pb-16 sm:px-6 sm:pb-20">
          <HeroVideo />

          <div className="animate-rise delay-4 mx-auto mt-9 flex max-w-[900px] flex-col items-center">
            <BookCta href={applyHref} />
          </div>
        </section>

        <div className="relative overflow-hidden border-y border-white/[0.07]">
          <Marquee pauseOnHover className="[--duration:36s]">
            {INCLUDED.map((item) => (
              <span
                key={item.title}
                className="mx-4 text-[13px] font-medium tracking-wide text-neutral-400"
              >
                {item.title}
              </span>
            ))}
          </Marquee>
        </div>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <p className={sectionLabel}>{INCLUDED_HEADLINE}</p>
            <IncludedCards items={INCLUDED} />
            <p className="mt-6 text-sm leading-relaxed text-neutral-400">{INCLUDED_FOOTNOTE}</p>
          </div>
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <p className={sectionLabel}>{FOUNDING_OFFER.eyebrow}</p>
            <h2 className="acq-headline mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {FOUNDING_OFFER.lead}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-[15px]">
              {FOUNDING_OFFER.body}
            </p>
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
