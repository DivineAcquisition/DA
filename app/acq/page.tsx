import Logo from '@/app/components/Logo';
import { BlurFade } from '@/components/ui/blur-fade';
import { DotPattern } from '@/components/ui/dot-pattern';
import { Panel } from '@/components/ui/panel';
import { ShineBorder } from '@/components/ui/shine-border';
import Link from 'next/link';
import { trackingFromSearchParams, type SearchParams } from '@/lib/acq/config';
import {
  AUDIENCE,
  CLOSING,
  CTA_LABEL,
  FACEBOOK_DISCLAIMER,
  FAQ,
  HEADLINE_ACCENT,
  HEADLINE_BEFORE,
  BUILD,
  HOW_IT_WORKS,
  PILL_BANNER,
  PROBLEM,
  QUESTIONS,
  SUBHEADLINE,
  WHY_US,
} from '@/lib/acq/copy';
import { AuditForm } from './components/AuditForm';
import { BuildBento } from './components/BuildBento';
import HeroVideo from './components/HeroVideo';
import { BookCta, FaqList, StatusPill, StepCards } from './components/marketing';

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="acq-headline max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
      {children}
    </h2>
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
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <div className="relative z-10">
        <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 pt-6 sm:px-6 sm:pt-8">
          <Logo className="h-5 w-auto sm:h-6" title="Divine Acquisition" />
          <Link
            href="#audit"
            className="text-sm font-semibold text-brand-200 transition hover:text-white"
          >
            {CTA_LABEL}
          </Link>
        </header>

        <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16">
          <DotPattern
            width={22}
            height={22}
            cr={1}
            className="text-brand-300/30 [mask-image:radial-gradient(ellipse_at_center,black_15%,transparent_72%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[760px] -translate-x-1/2"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(154,136,252,0.28) 0%, rgba(102,80,216,0.08) 42%, transparent 72%)',
              filter: 'blur(40px)',
            }}
          />

          <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
            <BlurFade>
              <div className="max-w-xl text-center lg:text-left">
                <StatusPill>{PILL_BANNER}</StatusPill>
                <h1 className="acq-headline mt-6 text-[2rem] font-semibold leading-[1.12] tracking-tight text-white sm:text-5xl sm:leading-[1.08]">
                  {HEADLINE_BEFORE}
                  <em className="acq-headline-accent">{HEADLINE_ACCENT}</em>
                </h1>
                <p className="mt-5 text-base leading-relaxed text-neutral-400 sm:text-[17px]">
                  {SUBHEADLINE}
                </p>
                <div className="mt-8 flex flex-col items-center lg:items-start">
                  <BookCta href="#audit" />
                  <p className="mt-3 text-sm text-neutral-500">{CLOSING.title}</p>
                </div>
              </div>
            </BlurFade>
            <HeroVideo />
          </div>
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <BlurFade inView>
              <SectionHeading>{PROBLEM.eyebrow}</SectionHeading>
              <p className="mt-5 text-base leading-relaxed text-neutral-300 sm:text-lg">{PROBLEM.body}</p>
            </BlurFade>
          </div>
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <BlurFade inView>
              <SectionHeading>{QUESTIONS.eyebrow}</SectionHeading>
            </BlurFade>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {QUESTIONS.items.map((question, index) => (
                <li key={question}>
                  <BlurFade inView delay={0.08 * index}>
                    <Panel className="h-full rounded-3xl p-6">
                      <span className="acq-headline text-sm font-semibold tabular-nums text-brand-300">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <p className="acq-headline mt-4 text-lg font-semibold leading-snug text-white">
                        {question}
                      </p>
                    </Panel>
                  </BlurFade>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <BlurFade inView>
              <SectionHeading>{BUILD.eyebrow}</SectionHeading>
            </BlurFade>
            <BuildBento />
          </div>
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <BlurFade inView>
              <SectionHeading>{HOW_IT_WORKS.eyebrow}</SectionHeading>
            </BlurFade>
            <StepCards items={HOW_IT_WORKS.steps} />
          </div>
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-16">
            <BlurFade inView>
              <SectionHeading>{WHY_US.eyebrow}</SectionHeading>
              <p className="mt-5 text-base leading-relaxed text-neutral-300">{WHY_US.lead}</p>
            </BlurFade>
            <ul className="divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/[0.02] px-5 sm:px-6">
              {WHY_US.items.map((item) => (
                <li key={item} className="flex items-start gap-3 py-4">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-500/15 text-brand-300">
                    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="m5 13 4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <p className="text-sm leading-relaxed text-neutral-200 sm:text-[15px]">{item}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <BlurFade inView>
              <SectionHeading>{AUDIENCE.eyebrow}</SectionHeading>
            </BlurFade>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Panel className="rounded-3xl p-6 sm:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">A fit</p>
                <p className="mt-3 text-base leading-relaxed text-neutral-200">{AUDIENCE.fit}</p>
              </Panel>
              <Panel className="rounded-3xl p-6 sm:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Not a fit
                </p>
                <p className="mt-3 text-base leading-relaxed text-neutral-400">{AUDIENCE.notFit}</p>
              </Panel>
            </div>
          </div>
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <BlurFade inView>
              <SectionHeading>{FAQ.eyebrow}</SectionHeading>
            </BlurFade>
            <FaqList />
          </div>
        </section>

        <section
          id="audit"
          className="hairline-glow relative scroll-mt-8 border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24"
        >
          <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <div>
              <SectionHeading>{CLOSING.title}</SectionHeading>
              <p className="mt-5 max-w-md text-base leading-relaxed text-neutral-400">{CLOSING.note}</p>
            </div>
            <Panel className="relative overflow-hidden rounded-3xl p-5 sm:p-7">
              <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} borderWidth={1} duration={14} />
              <AuditForm tracking={tracking} />
            </Panel>
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
