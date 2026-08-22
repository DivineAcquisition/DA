import Logo from '@/app/components/Logo';
import { trackingFromSearchParams, type SearchParams } from '@/lib/acq/config';
import {
  FACEBOOK_DISCLAIMER,
  FAQ,
  FOUNDING_OFFER,
  HEADLINE,
  INCLUDED,
  INCLUDED_FOOTNOTE,
  SUBHEADLINE,
} from '@/lib/acq/copy';
import AcqBackdrop from './components/AcqBackdrop';
import HeroVideo from './components/HeroVideo';
import { QualifyButton, QualifyProvider } from './components/QualifyGate';

function FeatureIcon({ index }: { index: number }) {
  const paths = [
    'M4 7h12M4 12h8M4 17h10',
    'M5 12h10M12 5l7 7-7 7',
    'M4 6h12v4H4zM4 14h7v4H4z',
    'M12 4v8l4 2',
    'M5 16l4-8 3 5 2-3 5 6',
    'M4 16V8a2 2 0 0 1 2-2h8M16 8v8a2 2 0 0 1-2 2H6',
    'M5 7h10v10H5zM8 4h4',
  ];
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-brand-300">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.6} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d={paths[index] ?? paths[0]} />
      </svg>
    </span>
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
        <AcqBackdrop />

        <div className="relative z-10">
          <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-6">
              <Logo className="h-[18px] w-auto sm:h-[20px]" title="Divine Acquisition" />
              <QualifyButton size="sm" className="hidden w-auto sm:inline-flex" />
            </div>
          </header>

          <section className="px-5 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-16">
            <div className="mx-auto max-w-[820px] text-center">
              <p className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-neutral-300">
                Stellar Sales Operations
              </p>

              <h1 className="acq-headline mx-auto mt-5 text-[1.55rem] font-semibold leading-[1.18] tracking-tight text-white sm:mt-6 sm:text-[2.25rem] md:text-[2.6rem] md:leading-[1.12]">
                {HEADLINE}
              </h1>

              <p className="mx-auto mt-5 max-w-[36rem] text-[15px] leading-relaxed text-neutral-400 sm:text-base">
                {SUBHEADLINE}
              </p>
            </div>
          </section>

          <section className="px-5 pb-8 sm:px-6">
            <HeroVideo />
            <div className="mx-auto mt-8 flex max-w-[880px] flex-col items-center">
              <QualifyButton />
            </div>
          </section>

          <section className="px-5 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-6xl">
              <div className="max-w-2xl">
                <p className="text-[12px] font-medium text-neutral-500">What&apos;s included</p>
                <h2 className="acq-headline mt-2 text-[1.75rem] font-semibold tracking-tight text-white sm:text-[2rem]">
                  Everything you need to turn demand into booked calls.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">{INCLUDED_FOOTNOTE}</p>
              </div>

              <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {INCLUDED.map((item, index) => (
                  <li
                    key={item.title}
                    className="rounded-2xl border border-white/[0.08] bg-ink-900/70 p-5"
                  >
                    <FeatureIcon index={index} />
                    <h3 className="mt-4 text-[15px] font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">{item.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="px-5 py-8 sm:px-6 sm:py-12">
            <div className="mx-auto max-w-2xl rounded-2xl border border-white/[0.08] bg-ink-900/70 p-6 sm:p-8">
              <p className="text-[12px] font-medium text-brand-300">{FOUNDING_OFFER.eyebrow}</p>
              <h2 className="acq-headline mt-2 text-[1.55rem] font-semibold tracking-tight text-white sm:text-[1.85rem]">
                {FOUNDING_OFFER.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400 sm:text-[15px]">
                {FOUNDING_OFFER.body}
              </p>
              <div className="mt-7">
                <QualifyButton />
              </div>
            </div>
          </section>

          <section className="px-5 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-3xl">
              <p className="text-[12px] font-medium text-neutral-500">FAQ</p>
              <h2 className="acq-headline mt-2 text-[1.75rem] font-semibold tracking-tight text-white sm:text-[2rem]">
                Need more answers?
              </h2>

              <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900/70">
                {FAQ.map((item, index) => (
                  <details
                    key={item.q}
                    className={`group px-5 py-4 sm:px-6 ${index > 0 ? 'border-t border-white/[0.06]' : ''}`}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-medium text-white marker:content-none [&::-webkit-details-marker]:hidden">
                      <span>{item.q}</span>
                      <span
                        aria-hidden
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] text-neutral-500 transition group-open:rotate-45"
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

          <section className="px-5 pb-20 pt-4 sm:px-6 sm:pb-24">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <QualifyButton />
            </div>
          </section>

          <footer className="border-t border-white/[0.06] px-5 py-10 text-center sm:px-6">
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
