import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { sectionLabel } from '@/app/components/ui';
import { trackingFromSearchParams, type SearchParams } from '@/lib/acq/config';
import {
  CASE_STUDY,
  FACEBOOK_DISCLAIMER,
  FAQ,
  FAQ_HEADLINE,
  FOUNDING_OFFER,
  HEADLINE,
  INCLUDED,
  INCLUDED_FOOTNOTE,
  INCLUDED_HEADLINE,
  PILL_BANNER,
  SUBHEADLINE,
} from '@/lib/acq/copy';
import HeroVideo from './components/HeroVideo';
import { QualifyButton, QualifyProvider } from './components/QualifyGate';

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.2 8.2 6.1 11.1 12.8 4.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function AcqLandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const tracking = trackingFromSearchParams(query);

  return (
    <QualifyProvider tracking={tracking}>
      <div className="min-h-screen bg-ink-950 text-white antialiased">
        <Backdrop />

        <div className="relative z-10">
          <header className="px-5 pt-6 sm:px-6 sm:pt-8">
            <div className="mx-auto flex max-w-5xl flex-col items-center">
              <Logo className="h-[20px] w-auto sm:h-[24px]" title="Divine Acquisition" />
              <p className="acq-headline animate-rise mt-6 inline-flex items-center rounded-full border border-brand-500/30 bg-brand-500/[0.08] px-3.5 py-1.5 text-[12px] font-semibold tracking-tight text-brand-200 sm:mt-7 sm:text-[13px]">
                {PILL_BANNER}
              </p>
            </div>
          </header>

          <section className="px-5 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-10 md:pt-12">
            <div className="mx-auto max-w-[900px] text-center">
              <h1 className="acq-headline animate-rise delay-1 mx-auto max-w-[920px] text-[1.45rem] font-semibold leading-[1.16] tracking-tight text-white sm:text-[2.05rem] md:text-[2.4rem] md:leading-[1.12]">
                {HEADLINE}
              </h1>

              <p className="animate-rise delay-2 mx-auto mt-4 max-w-[34rem] text-sm leading-relaxed text-neutral-400 sm:mt-5 sm:text-[15px]">
                {SUBHEADLINE}
              </p>
            </div>
          </section>

          <section className="px-5 pb-16 sm:px-6 sm:pb-20">
            <HeroVideo />

            <div className="animate-rise delay-4 mx-auto mt-9 flex max-w-[900px] flex-col items-center">
              <QualifyButton />
            </div>
          </section>

          <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <p className={sectionLabel}>{INCLUDED_HEADLINE}</p>
              <ul className="mt-8 divide-y divide-white/[0.06] border-y border-white/[0.06]">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex gap-3 py-3.5 sm:gap-4">
                    <CheckIcon />
                    <p className="text-[15px] leading-relaxed text-white">{item}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-relaxed text-neutral-400">{INCLUDED_FOOTNOTE}</p>
            </div>
          </section>

          <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <p className={sectionLabel}>{CASE_STUDY.headline}</p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400 sm:text-[15px]">
                {CASE_STUDY.body}
              </p>
              <div className="panel mt-8 rounded-3xl px-6 py-10 text-center sm:px-10 sm:py-14">
                <p className="acq-headline text-[3.4rem] font-semibold leading-none tracking-tight text-white sm:text-[5rem]">
                  {CASE_STUDY.callout}
                </p>
                <p className="mt-3 text-sm font-medium uppercase tracking-[0.14em] text-neutral-400 sm:text-[13px]">
                  {CASE_STUDY.calloutLabel}
                </p>
              </div>
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

          <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <p className={sectionLabel}>{FAQ_HEADLINE}</p>
              <div className="mt-8 divide-y divide-white/[0.06] border-y border-white/[0.06]">
                {FAQ.map((item) => (
                  <details key={item.q} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left text-[15px] font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden">
                      <span>{item.q}</span>
                      <span aria-hidden className="mt-0.5 text-neutral-500 transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <QualifyButton />
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
    </QualifyProvider>
  );
}
