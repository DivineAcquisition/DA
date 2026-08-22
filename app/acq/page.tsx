import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { eyebrow, sectionLabel } from '@/app/components/ui';
import { trackingFromSearchParams, type SearchParams } from '@/lib/acq/config';
import {
  CASE_STUDY,
  FACEBOOK_DISCLAIMER,
  FAQ,
  FOUNDING_OFFER,
  HEADLINE,
  INCLUDED,
  INCLUDED_FOOTNOTE,
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
            <div className="mx-auto flex max-w-5xl justify-center">
              <Logo className="h-[20px] w-auto sm:h-[24px]" title="Divine Acquisition" />
            </div>
          </header>

          <section className="px-5 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-14 md:pt-16">
            <div className="mx-auto max-w-[900px] text-center">
              <p className={`${eyebrow} animate-rise pointer-events-none select-none`}>
                Stellar Sales Operations · Founding install
              </p>

              <h1 className="acq-headline animate-rise delay-1 mx-auto mt-5 max-w-[920px] text-[1.45rem] font-semibold leading-[1.16] tracking-tight text-white sm:mt-6 sm:text-[2.05rem] md:text-[2.4rem] md:leading-[1.12]">
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
              <p className={sectionLabel}>What&apos;s included</p>
              <h2 className="acq-headline mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                The full sales operation system. Built in 14 days.
              </h2>

              <ul className="mt-8 divide-y divide-white/[0.06] border-y border-white/[0.06]">
                {INCLUDED.map((item) => (
                  <li key={item.title} className="flex gap-3 py-4 sm:gap-4 sm:py-5">
                    <CheckIcon />
                    <div>
                      <p className="text-[15px] font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-neutral-400">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-sm leading-relaxed text-neutral-400">{INCLUDED_FOOTNOTE}</p>
            </div>
          </section>

          <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <p className={sectionLabel}>Case study</p>
              <p className="mt-3 text-sm text-neutral-400">{CASE_STUDY.context}</p>

              <div className="panel mt-8 rounded-3xl px-6 py-10 text-center sm:px-10 sm:py-14">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
                  {CASE_STUDY.name}
                </p>
                <p className="acq-headline mt-4 text-[3.4rem] font-semibold leading-none tracking-tight text-white sm:text-[5rem]">
                  {CASE_STUDY.resultValue}
                </p>
                <p className="mt-3 text-sm font-medium uppercase tracking-[0.14em] text-neutral-400 sm:text-[13px]">
                  {CASE_STUDY.resultLabel}
                </p>
                <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-neutral-400">
                  {CASE_STUDY.setup}
                </p>
              </div>
            </div>
          </section>

          <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <p className={sectionLabel}>{FOUNDING_OFFER.eyebrow}</p>
              <h2 className="acq-headline mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {FOUNDING_OFFER.title}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-[15px]">
                {FOUNDING_OFFER.body}
              </p>
              <div className="mt-8">
                <QualifyButton />
              </div>
            </div>
          </section>

          <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <p className={sectionLabel}>FAQ</p>
              <h2 className="acq-headline mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Straight answers before you apply.
              </h2>

              <div className="mt-8 divide-y divide-white/[0.06] border-y border-white/[0.06]">
                {FAQ.map((item) => (
                  <details key={item.q} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left text-[15px] font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden">
                      <span>{item.q}</span>
                      <span
                        aria-hidden
                        className="mt-0.5 text-neutral-500 transition group-open:rotate-45"
                      >
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
