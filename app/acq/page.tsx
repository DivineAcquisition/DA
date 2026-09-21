import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { headers } from 'next/headers';
import {
  acqBookUrl,
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
  LANDING_FAQ,
  LANDING_FAQ_TITLE,
  LANDING_GET_TITLE,
  LANDING_REQUIREMENT,
  LANDING_STATS,
  LANDING_WHO,
  LANDING_WHY,
  PILL_BANNER,
  SUBHEADLINE,
} from '@/lib/acq/copy';
import HeroVideo from './components/HeroVideo';
import { BookCta, StatusPill } from './components/marketing';
import { Panel } from '@/components/ui/panel';

function LandingCta({ href }: { href: string }) {
  return (
    <div className="flex justify-center">
      <BookCta href={href} className="max-w-xl uppercase tracking-[0.04em]" />
    </div>
  );
}

export default async function AcqLandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [query, headerList] = await Promise.all([searchParams, headers()]);
  const bookHref = acqBookUrl(trackingFromSearchParams(query), headerList.get('host'));

  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />

      <div className="relative z-10">
        <header className="relative z-10 px-5 pt-6 sm:px-6 sm:pt-8">
          <div className="mx-auto flex max-w-5xl flex-col items-center">
            <Logo className="h-[20px] w-auto sm:h-[24px]" title="Divine Acquisition" />
            <div className="acq-headline mt-8">
              <StatusPill variant="solid" className="uppercase tracking-[0.08em]">
                {PILL_BANNER}
              </StatusPill>
            </div>
          </div>
        </header>

        <section className="relative z-10 px-5 pb-6 pt-8 sm:px-6 sm:pt-10">
          <div className="mx-auto max-w-[920px] text-center">
            <h1 className="acq-headline mx-auto max-w-[920px] text-[1.55rem] font-bold uppercase leading-[1.08] tracking-tight text-white sm:text-[2.15rem] md:text-[2.55rem]">
              {HEADLINE_BEFORE}
              <em className="acq-headline-accent">{HEADLINE_ACCENT}</em>
              {HEADLINE_AFTER}
            </h1>
            <p className="mx-auto mt-6 max-w-[40rem] text-sm font-medium leading-relaxed text-neutral-300 sm:text-base">
              {SUBHEADLINE}
            </p>
            <p className="acq-headline mt-8 text-sm font-bold uppercase tracking-tight text-white sm:text-base">
              {LANDING_REQUIREMENT}
            </p>
            <div className="mt-5">
              <LandingCta href={bookHref} />
            </div>
          </div>

          <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-1 divide-y divide-white/10 sm:mt-14 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {LANDING_STATS.map((stat) => (
              <div key={stat.label} className="px-4 py-5 text-center sm:py-2">
                <dt className="acq-headline text-sm font-bold uppercase tracking-tight text-white sm:text-[15px]">
                  {stat.label}
                </dt>
                <dd className="mt-2 text-xs leading-relaxed text-neutral-400 sm:text-sm">{stat.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="px-5 pb-16 pt-6 sm:px-6 sm:pb-20">
          <HeroVideo />
        </section>

        <section className="border-t border-white/[0.08] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="acq-headline text-center text-sm font-bold uppercase tracking-[0.16em] text-neutral-400">
              {LANDING_GET_TITLE}
            </h2>
            <div className="mt-12 space-y-14">
              {INCLUDED.map((item) => (
                <article key={item.title}>
                  <h3 className="acq-headline text-[1.65rem] font-bold uppercase leading-[1.05] tracking-tight text-white sm:text-4xl">
                    {item.title}
                  </h3>
                  <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-neutral-300 sm:text-base">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
            <p className="mt-12 text-sm font-medium leading-relaxed text-neutral-400">{INCLUDED_FOOTNOTE}</p>
            <div className="mt-10">
              <LandingCta href={bookHref} />
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.08] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="acq-headline text-center text-sm font-bold uppercase tracking-[0.16em] text-neutral-400">
              {LANDING_WHY.eyebrow}
            </h2>
            <p className="acq-headline mt-10 text-2xl font-bold text-white sm:text-3xl">{LANDING_WHY.intro}</p>
            <p className="mt-5 text-sm font-medium leading-relaxed text-neutral-300 sm:text-base">{LANDING_WHY.body}</p>
            <ol className="mt-12 space-y-10">
              {LANDING_WHY.points.map((point, index) => (
                <li key={point.title} className="grid grid-cols-[2.5rem_1fr] gap-3 sm:gap-5">
                  <span className="acq-headline pt-1 text-sm font-bold tabular-nums text-brand-300">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="acq-headline text-xl font-bold uppercase leading-tight tracking-tight text-white sm:text-2xl">
                      {point.title}
                    </h3>
                    <p className="mt-3 text-sm font-medium leading-relaxed text-neutral-300 sm:text-base">
                      {point.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <h3 className="acq-headline mt-14 text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
              {LANDING_WHY.closeTitle}
            </h3>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-neutral-300 sm:text-base">
              {LANDING_WHY.closeBody}
            </p>
            <p className="mt-6 text-sm font-medium leading-relaxed text-neutral-400">{FOUNDING_OFFER.body}</p>
            <div className="mt-10">
              <LandingCta href={bookHref} />
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.08] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="acq-headline text-center text-sm font-bold uppercase tracking-[0.16em] text-neutral-400">
              {LANDING_WHO.eyebrow}
            </h2>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2">
              {LANDING_WHO.items.map((item) => (
                <li key={item.title}>
                  <Panel className="h-full rounded-3xl p-6 sm:p-8">
                    <h3 className="acq-headline text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
                      {item.title}
                    </h3>
                    <p className="mt-4 text-sm font-medium leading-relaxed text-neutral-300 sm:text-base">
                      {item.body}
                    </p>
                  </Panel>
                </li>
              ))}
            </ul>
            <div className="mt-12">
              <LandingCta href={bookHref} />
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.08] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="acq-headline text-center text-sm font-bold uppercase tracking-[0.16em] text-neutral-400">
              {LANDING_FAQ_TITLE}
            </h2>
            <div className="mt-8 border-t border-white/10">
              {LANDING_FAQ.map((item) => (
                <details key={item.q} className="group border-b border-white/10">
                  <summary className="acq-headline flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-semibold text-white sm:text-lg [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="text-xl font-light text-brand-300 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-5 text-sm font-medium leading-relaxed text-neutral-300 sm:text-base">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
            <div className="mt-12">
              <LandingCta href={bookHref} />
            </div>
          </div>
        </section>

        <footer className="border-t border-white/[0.08] px-5 py-10 text-center sm:px-6">
          <p className="text-xs text-neutral-600">© Divine Acquisition. All rights reserved.</p>
          <p className="mx-auto mt-5 max-w-2xl text-[10px] leading-relaxed text-neutral-600 sm:text-[11px]">
            {FACEBOOK_DISCLAIMER}
          </p>
        </footer>
      </div>
    </div>
  );
}
