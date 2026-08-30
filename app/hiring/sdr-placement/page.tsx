'use client';

import type { ComponentType, CSSProperties } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import { SDR_MONTHLY_BASE } from '../../data/roles';
import { sectionLabel } from '../../components/ui';
import {
  BeamFrame,
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
  { value: SDR_MONTHLY_BASE, label: 'Monthly base' },
  { value: 'Commission', label: 'On every appointment you book' },
  { value: '2× / month', label: 'Payout schedule' },
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

function FactsStrip({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[13px] text-neutral-400 ${className}`}>
      {facts.map((fact, index) => (
        // The separator trails its fact so a wrapped line never opens with a stray dot.
        <li key={fact} className="flex items-center gap-3">
          {fact}
          {index < facts.length - 1 && (
            <span aria-hidden className="h-1 w-1 rounded-full bg-brand-500/70" />
          )}
        </li>
      ))}
    </ul>
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

      <div className="relative z-10">
        <SiteHeader
          action={
            <>
              <span className="hidden sm:contents">
                <Link href="/hiring" className={`${hiringBtnSecondary} ${hiringBtnSm}`}>
                  All roles
                </Link>
              </span>
              <a href={APPLY_URL} target="_blank" rel="noopener noreferrer" className={`${hiringBtn} ${hiringBtnSm}`}>
                Apply now
              </a>
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
              <span className="text-gradient">Not Virtual Assistants.</span>
            </h1>

            <p className="animate-rise delay-2 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-[17px]">
              We train you, certify you, and place you inside a real business where one job is yours:
              nobody who reaches out ever gets ignored. $400 to $600 a month base, plus commission on
              every appointment you book.
            </p>
          </div>

          {/* Video */}
          <div className="animate-rise delay-3 mx-auto mt-10 max-w-4xl sm:mt-12">
            <BeamFrame>
              <div className="bg-black">
                <WistiaPlayer media-id={WISTIA_MEDIA_ID} aspect="1.7777777777777777" />
              </div>
            </BeamFrame>
          </div>

          {/* Apply CTA + facts */}
          <div className="animate-rise delay-4 mx-auto mt-10 flex max-w-4xl flex-col items-center">
            <a
              href={APPLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${hiringBtn} ${hiringBtnLg} ${hiringBtnFull} uppercase tracking-[0.06em]`}
            >
              Apply now
              <ArrowIcon className="h-4 w-4" />
            </a>
            <FactsStrip className="mt-5" />
          </div>
          </div>
        </section>

        {/* How placement works */}
        <section className="px-5 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <div className="max-w-2xl">
              <p className={sectionLabel}>How placement works</p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                Trained, certified, then placed — in that order.
              </h2>
            </div>

            <ol className="mt-9 grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.label}>
                  <SurfaceCard as="div" cardClassName="rounded-2xl p-6">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-500/25 bg-brand-500/10 text-sm font-bold tabular-nums text-brand-300">
                      {index + 1}
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-white">{step.label}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">{step.body}</p>
                  </SurfaceCard>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Compensation */}
        <section className="px-5 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-4xl">
            <div className="max-w-2xl">
              <p className={sectionLabel}>What you earn</p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">A base you can count on, plus upside you control.</h2>
            </div>

            <dl className="mt-9 grid gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.05] sm:grid-cols-3">
              {offer.map((item) => (
                <div key={item.label} className="bg-ink-950/85 px-6 py-7">
                  <dd className="text-2xl font-semibold text-brand-300 sm:text-[26px]">{item.value}</dd>
                  <dt className="mt-2 text-sm text-neutral-400">{item.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="px-5 pb-20 pt-6 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <ShinePanel className="rounded-3xl px-6 py-12 text-center sm:px-10 sm:py-16">
              <div
                aria-hidden
                className="absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2"
                style={{ background: 'radial-gradient(ellipse at center, rgba(154,136,252,0.28) 0%, transparent 70%)' }}
              />
              <div className="relative">
                <h2 className="text-2xl font-semibold sm:text-[34px]">
                  One job is yours: nobody gets ignored.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-400">
                  If that sounds like the standard you want to be held to, start your application.
                </p>
                <div className="mt-8 flex flex-col items-center gap-4">
                  <a
                    href={APPLY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${hiringBtn} ${hiringBtnLg} ${hiringBtnFull} uppercase tracking-[0.06em]`}
                  >
                    Apply now
                    <ArrowIcon />
                  </a>
                  <FactsStrip />
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
