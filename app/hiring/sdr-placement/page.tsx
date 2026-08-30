'use client';

import type { ComponentType, CSSProperties } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { BorderBeam } from '@/components/ui/border-beam';
import { Marquee } from '@/components/ui/marquee';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Panel } from '@/components/ui/panel';
import { ShineBorder } from '@/components/ui/shine-border';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import { SDR_MONTHLY_BASE } from '../../data/roles';
import { sectionLabel } from '../../components/ui';
import {
  HiringHeroBackdrop,
  HiringStatusPill,
  ShinePanel,
  SurfaceCard,
  hiringBtn,
  hiringBtnFull,
  hiringBtnLg,
  hiringBtnMd,
  hiringBtnSecondary,
  hiringBtnSm,
} from '../components/visual';

const APPLY_URL = 'https://airtable.com/appI4kbEVdi5THUbs/pagQySxRueaPdgW4n/form';
const WISTIA_MEDIA_ID = 'lrplfrikyd';
const [baseMin, baseMax] = (SDR_MONTHLY_BASE.match(/\d+/g) ?? ['400', '600']).map(Number);

const facts = ['Remote', 'Full-time', 'Training provided', 'Paid twice a month'];

const steps = [
  {
    label: 'We train you',
    body: 'You learn the craft before you ever touch a live conversation — how to respond, qualify, and move someone to a booked appointment.',
  },
  {
    label: 'We certify you',
    body: "You don't get placed until you can prove the standard. Certification is how we know you are ready for a real pipeline.",
  },
  {
    label: 'We place you',
    body: 'You go inside a real business with one job that is yours: nobody who reaches out ever gets ignored.',
  },
];

const offer = [
  { kind: 'base' as const, label: 'Monthly base' },
  { kind: 'text' as const, value: 'Commission', label: 'On every appointment you book' },
  { kind: 'text' as const, value: '2× / month', label: 'Payout schedule' },
];

// `wistia-player` is a custom element registered by Wistia's player script.
// Typing it locally keeps the JSX honest without a global namespace augmentation.
const WistiaPlayer = 'wistia-player' as unknown as ComponentType<{
  'media-id': string;
  aspect?: string;
  style?: CSSProperties;
}>;

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" />
    </svg>
  );
}

function PlayIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v14l11-7-11-7Z" />
    </svg>
  );
}

function FactsChips({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      {facts.map((fact) => (
        <li
          key={fact}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[13px] font-medium text-neutral-300"
        >
          {fact}
        </li>
      ))}
    </ul>
  );
}

function ApplyLink({
  className = '',
  children = 'Apply now',
}: {
  className?: string;
  children?: string;
}) {
  return (
    <a href={APPLY_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <ArrowIcon className="h-4 w-4" />
    </a>
  );
}

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className={sectionLabel}>
      <AnimatedShinyText className="mx-0 max-w-none text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300 dark:text-brand-300">
        {children}
      </AnimatedShinyText>
    </p>
  );
}

export default function SdrPlacementPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />
      <Script
        src={`https://fast.wistia.com/embed/${WISTIA_MEDIA_ID}.js`}
        strategy="afterInteractive"
        type="module"
      />
      <style>{`wistia-player[media-id='${WISTIA_MEDIA_ID}']:not(:defined) { background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/${WISTIA_MEDIA_ID}/swatch'); display: block; filter: blur(5px); padding-top:56.25%; }`}</style>

      <div className="relative z-10">
        <SiteHeader
          action={
            <>
              <span className="hidden sm:contents">
                <Link href="/hiring" className={`${hiringBtnSecondary} ${hiringBtnSm}`}>
                  All roles
                </Link>
              </span>
              <ApplyLink className={`${hiringBtn} ${hiringBtnSm}`} />
            </>
          }
        />

        {/* VSL hero */}
        <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
          <HiringHeroBackdrop />
          <div className="relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              <div className="animate-rise">
                <HiringStatusPill>SDR Placement Role</HiringStatusPill>
              </div>

              <h1 className="animate-rise delay-1 mt-6 text-[2.1rem] font-semibold leading-[1.06] sm:text-5xl md:text-[3.4rem]">
                We&apos;re Hiring Operators.
                <br />
                <em className="hiring-headline-accent">Not Virtual Assistants.</em>
              </h1>

              <p className="animate-rise delay-2 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-[17px]">
                We train you, certify you, and place you inside a real business where one job is yours:
                nobody who reaches out ever gets ignored. $400 to $600 a month base, plus commission on
                every appointment you book.
              </p>
            </div>

            <div className="animate-rise delay-3 relative mx-auto mt-10 max-w-4xl sm:mt-12">
              <div
                aria-hidden
                className="absolute inset-x-6 -bottom-6 top-8 rounded-[2rem] opacity-70 blur-2xl"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(154,136,252,0.4) 0%, transparent 70%)',
                }}
              />
              <Panel className="relative overflow-hidden rounded-3xl p-1.5 sm:p-2">
                <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} borderWidth={1} duration={12} />
                <BorderBeam size={90} duration={8} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} />
                <BorderBeam
                  size={90}
                  duration={8}
                  delay={4}
                  reverse
                  colorFrom="#C3B6FE"
                  colorTo="#9A88FC"
                  borderWidth={1}
                />
                <div className="overflow-hidden rounded-[1.25rem] bg-black">
                  <WistiaPlayer media-id={WISTIA_MEDIA_ID} aspect="1.7777777777777777" />
                </div>
              </Panel>
            </div>

            <div className="animate-rise delay-4 mx-auto mt-10 flex max-w-4xl flex-col items-center">
              <ApplyLink
                className={`${hiringBtn} ${hiringBtnLg} ${hiringBtnFull} uppercase tracking-[0.06em]`}
              />
              <FactsChips className="mt-5" />
            </div>
          </div>
        </section>

        <div className="relative overflow-hidden border-y border-white/[0.07]">
          <Marquee pauseOnHover className="[--duration:28s]">
            {facts.map((fact) => (
              <span
                key={fact}
                className="mx-5 inline-flex items-center gap-2 text-[13px] font-medium tracking-wide text-neutral-400"
              >
                <PlayIcon className="h-3 w-3 text-brand-400" />
                {fact}
              </span>
            ))}
          </Marquee>
        </div>

        {/* How placement works */}
        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <div className="max-w-2xl">
              <SectionEyebrow>How placement works</SectionEyebrow>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                Trained, certified, then placed — in that order.
              </h2>
            </div>

            <div className="relative mt-9">
              <div
                aria-hidden
                className="pointer-events-none absolute top-10 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-brand-500/0 via-brand-500/45 to-brand-500/0 md:block"
              />
              <ol className="grid gap-4 md:grid-cols-3">
                {steps.map((step, index) => (
                  <li key={step.label}>
                    <SurfaceCard hover as="div" cardClassName="rounded-2xl p-6">
                      <span className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/12 text-sm font-bold tabular-nums text-brand-200">
                        {index + 1}
                      </span>
                      <h3 className="mt-4 text-base font-semibold text-white">{step.label}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-neutral-400">{step.body}</p>
                    </SurfaceCard>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Compensation */}
        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <div className="max-w-2xl">
              <SectionEyebrow>What you earn</SectionEyebrow>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                A base you can count on, plus upside you control.
              </h2>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {offer.map((item) => (
                <SurfaceCard key={item.label} hover cardClassName="rounded-2xl px-6 py-7">
                  {item.kind === 'base' ? (
                    <p className="text-2xl font-semibold text-brand-300 sm:text-[26px]">
                      $
                      <NumberTicker
                        value={baseMin}
                        className="text-2xl font-semibold tracking-normal text-brand-300 sm:text-[26px]"
                      />
                      –
                      $
                      <NumberTicker
                        value={baseMax}
                        className="text-2xl font-semibold tracking-normal text-brand-300 sm:text-[26px]"
                      />
                    </p>
                  ) : (
                    <p className="text-2xl font-semibold text-brand-300 sm:text-[26px]">{item.value}</p>
                  )}
                  <p className="mt-2 text-sm text-neutral-400">{item.label}</p>
                </SurfaceCard>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="px-5 pb-20 pt-6 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <ShinePanel className="rounded-3xl px-6 py-12 text-center sm:px-10 sm:py-16">
              <BorderBeam size={100} duration={10} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} />
              <div
                aria-hidden
                className="absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgba(154,136,252,0.32) 0%, transparent 70%)',
                }}
              />
              <div className="relative">
                <div className="flex justify-center">
                  <HiringStatusPill>Start your application</HiringStatusPill>
                </div>
                <h2 className="mt-5 text-2xl font-semibold sm:text-[34px]">
                  One job is yours: nobody gets ignored.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-400">
                  If that sounds like the standard you want to be held to, start your application.
                </p>
                <div className="mt-8 flex flex-col items-center gap-4">
                  <ApplyLink
                    className={`${hiringBtn} ${hiringBtnLg} ${hiringBtnFull} uppercase tracking-[0.06em]`}
                  />
                  <FactsChips />
                  <Link href="/hiring" className={`${hiringBtnSecondary} ${hiringBtnMd} mt-2`}>
                    See all open roles
                  </Link>
                </div>
              </div>
            </ShinePanel>
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}
