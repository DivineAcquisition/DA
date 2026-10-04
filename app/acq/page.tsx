import Logo from '@/app/components/Logo';
import { BlurFade } from '@/components/ui/blur-fade';
import { DotPattern } from '@/components/ui/dot-pattern';
import { Panel } from '@/components/ui/panel';
import { trackingFromSearchParams, type SearchParams } from '@/lib/acq/config';
import {
  AUDIENCE,
  BUILD,
  CLOSING,
  FACEBOOK_DISCLAIMER,
  FAQ,
  HEADLINE_ACCENT,
  HEADLINE_AFTER,
  HEADLINE_BEFORE,
  HOW_IT_WORKS,
  PILL_BANNER,
  PROBLEM,
  QUESTIONS,
  SUBHEADLINE,
  WHY_US,
} from '@/lib/acq/copy';
import { BuildBento } from './components/BuildBento';
import HeroVideo from './components/HeroVideo';
import { FaqList, StatusPill, StepCards } from './components/marketing';
import { QualifyButton, QualifyProvider } from './components/QualifyGate';

function SectionHeading({ children, align = 'center' }: { children: string; align?: 'center' | 'left' }) {
  return (
    <h2
      className={`acq-headline max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl ${
        align === 'center' ? 'mx-auto text-center' : ''
      }`}
    >
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
    <QualifyProvider tracking={tracking}>
      <div className="min-h-screen bg-ink-950 text-white antialiased">
        <div className="relative z-10">
          <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 pt-6 sm:px-6 sm:pt-8">
            <Logo className="h-5 w-auto sm:h-6" title="Divine Acquisition" />
            <QualifyButton variant="nav" />
          </header>

          <section className="relative overflow-hidden px-5 pb-8 pt-10 sm:px-6 sm:pt-14">
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

            <div className="relative z-10 mx-auto max-w-[920px] text-center">
              <StatusPill>{PILL_BANNER}</StatusPill>
              <h1 className="acq-headline mt-6 text-[1.45rem] font-semibold leading-[1.16] tracking-tight text-white sm:text-[2.05rem] md:text-[2.4rem] md:leading-[1.12]">
                {HEADLINE_BEFORE}
                <em className="acq-headline-accent">{HEADLINE_ACCENT}</em>
                {HEADLINE_AFTER}
              </h1>
              <p className="mx-auto mt-4 max-w-[34rem] text-sm leading-relaxed text-neutral-400 sm:mt-5 sm:text-[15px]">
                {SUBHEADLINE}
              </p>
            </div>
          </section>

          <section className="px-5 pb-16 sm:px-6 sm:pb-20">
            <HeroVideo />
            <div className="mx-auto mt-9 flex max-w-[900px] flex-col items-center">
              <QualifyButton />
              <p className="mt-3 text-center text-sm text-neutral-500">{CLOSING.title}</p>
            </div>
          </section>

          <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-3xl">
              <BlurFade inView>
                <SectionHeading>{PROBLEM.eyebrow}</SectionHeading>
                <p className="mt-5 text-center text-base leading-relaxed text-neutral-300 sm:text-lg">
                  {PROBLEM.body}
                </p>
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
              <div className="mt-10 flex justify-center">
                <QualifyButton />
              </div>
            </div>
          </section>

          <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-16">
              <BlurFade inView>
                <SectionHeading align="left">{WHY_US.eyebrow}</SectionHeading>
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

          <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <SectionHeading>{CLOSING.title}</SectionHeading>
              <p className="mt-4 text-base leading-relaxed text-neutral-400">{CLOSING.note}</p>
              <div className="mt-8 flex justify-center">
                <QualifyButton />
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
    </QualifyProvider>
  );
}
