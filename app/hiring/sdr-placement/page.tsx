'use client';

import type { ComponentType, CSSProperties } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { ArrowRight, BadgeCheck, GraduationCap, Play, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SDR_MONTHLY_BASE } from '../../data/roles';
import ApplicationForm from '../components/ApplicationForm';
import { ApplicantPath, BeamRow, HiringNow } from '../components/agentic';
import {
  CareersFooter,
  CareersHeader,
  CareersShell,
  FaqList,
  GlowFrame,
  Section,
  btnPrimary,
  btnSecondary,
  eyebrow,
  gutter,
  heroTitle,
  lead,
  panel,
  sectionTitle,
  shell,
  subhead,
  type Faq,
} from '../components/careers-ui';

const WISTIA_MEDIA_ID = 'lrplfrikyd';

const facts = ['Remote', 'Full-time', 'Training provided', 'Paid twice a month'];

const steps = [
  {
    label: 'We train you',
    body: 'You learn the craft before you ever touch a live conversation — how to respond, qualify, and move someone to a booked appointment.',
    icon: GraduationCap,
  },
  {
    label: 'We certify you',
    body: "You don't get placed until you can prove the standard. Certification is how we know you are ready for a real pipeline.",
    icon: BadgeCheck,
  },
  {
    label: 'We place you',
    body: 'You go inside a real business with one job that is yours: nobody who reaches out ever gets ignored.',
    icon: Store,
  },
];

const faqs: Faq[] = [
  {
    q: 'Do I need sales experience?',
    a: 'No. You are trained before you touch a live conversation, and certified before you are placed inside a business.',
  },
  {
    q: 'How am I paid?',
    a: `${SDR_MONTHLY_BASE.replace('–', ' to ')} a month base, plus commission on every appointment you book. Payouts go out twice a month.`,
  },
  {
    q: 'Is it remote?',
    a: 'Yes. The role is remote and full-time.',
  },
  {
    q: 'What happens after I apply?',
    a: 'A person reads your application. If we move you forward, you get an email to set up your account and your operator file opens. Onboarding and training come before any placement.',
  },
];

// `wistia-player` is a custom element registered by Wistia's player script.
const WistiaPlayer = 'wistia-player' as unknown as ComponentType<{
  'media-id': string;
  aspect?: string;
  style?: CSSProperties;
}>;

export default function SdrPlacementPage() {
  return (
    <CareersShell>
      <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />
      <Script src={`https://fast.wistia.com/embed/${WISTIA_MEDIA_ID}.js`} strategy="afterInteractive" type="module" />
      <style>{`wistia-player[media-id='${WISTIA_MEDIA_ID}']:not(:defined) { background: center / contain no-repeat url('https://fast.wistia.com/embed/medias/${WISTIA_MEDIA_ID}/swatch'); display: block; filter: blur(5px); padding-top:56.25%; }`}</style>

      <CareersHeader action={{ href: '#apply', label: 'Apply now' }} />

      {/* Hero */}
      <section className={cn(gutter, 'relative pb-16 pt-14 sm:pb-24 sm:pt-20')}>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(55%_55%_at_50%_0%,rgba(154,136,252,0.16),transparent_70%)]" />
        <div className={cn(shell, 'relative')}>
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex items-center justify-center gap-3">
              <p className={eyebrow}>SDR Placement Role</p>
              <HiringNow />
            </div>
            <h1 className={cn(heroTitle, 'mt-4')}>
              We&apos;re hiring operators.
              <br />
              <span className="bg-gradient-to-b from-[#7e67f2] to-[#5140a9] bg-clip-text text-transparent">Not virtual assistants.</span>
            </h1>
            <p className={cn(subhead, 'mx-auto mt-6 max-w-2xl')}>
              We train you, certify you, and place you inside a real business where one job is yours: nobody who reaches out ever gets ignored.{' '}
              {SDR_MONTHLY_BASE.replace('–', ' to ')} a month base, plus commission on every appointment you book.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#apply" className={btnPrimary}>
                Apply now
                <ArrowRight className="size-4" aria-hidden />
              </a>
              <a href="#how" className={btnSecondary}>
                How placement works
              </a>
            </div>
          </div>

          <GlowFrame className="mx-auto mt-12 max-w-4xl !p-2 sm:!p-2.5">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-2 rounded-full bg-black/10" />
                <span className="size-2 rounded-full bg-black/10" />
                <span className="size-2 rounded-full bg-[#7e67f2]" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-c-line bg-c-soft px-2 py-0.5 text-[11px] text-c-muted">
                <Play className="size-3 fill-[#7e67f2] text-[#7e67f2]" aria-hidden />
                The walkthrough
              </span>
            </div>
            <div className="overflow-hidden rounded-lg bg-black">
              <WistiaPlayer media-id={WISTIA_MEDIA_ID} aspect="1.7777777777777777" />
            </div>
          </GlowFrame>

          <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-2">
            {facts.map((fact) => (
              <li key={fact} className="inline-flex items-center gap-2 rounded-full border border-c-line bg-white px-3 py-1.5 text-[13px] font-medium text-c-ink">
                <span aria-hidden className="size-1.5 rounded-full bg-[#7e67f2]" />
                {fact}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How placement works: the three cards joined by beams */}
      <Section id="how" eyebrow="How placement works" headline="Trained, certified, then placed — in that order.">
        <BeamRow count={steps.length} id="sdr-steps">
          <ol className="grid gap-4 md:grid-cols-3 md:gap-12">
            {steps.map((step, index) => (
              <li key={step.label} data-step={index} className={cn(panel, 'p-6')}>
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-lg border border-c-line bg-c-soft">
                    <step.icon className="size-5 text-[#7e67f2]" aria-hidden />
                  </span>
                  <span className="rounded-full border border-c-line px-1.5 text-[11px] tabular-nums text-c-muted">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-5 text-lg font-medium tracking-tight text-c-ink">{step.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-c-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </BeamRow>
      </Section>

      {/* What you earn */}
      <Section eyebrow="What you earn" headline="A base you can count on, plus upside you control.">
        <div className="grid gap-4 sm:grid-cols-3">
          <GlowFrame className="!p-6">
            {/* Static on purpose: a pay figure should never count up through other numbers. */}
            <p className="text-3xl font-medium tracking-tight text-c-violet">{SDR_MONTHLY_BASE}</p>
            <p className="mt-2 text-sm text-c-muted">Monthly base</p>
          </GlowFrame>
          <div className={cn(panel, 'p-6')}>
            <p className="text-3xl font-medium tracking-tight text-c-ink">Commission</p>
            <p className="mt-2 text-sm text-c-muted">On every appointment you book</p>
          </div>
          <div className={cn(panel, 'p-6')}>
            <p className="text-3xl font-medium tracking-tight text-c-ink">2× / month</p>
            <p className="mt-2 text-sm text-c-muted">Payout schedule</p>
          </div>
        </div>
      </Section>

      {/* After you apply */}
      <Section id="after" eyebrow="After you apply" headline="What happens next." lead="A person reads every application, and nothing reaches a client until you are trained and certified.">
        <ApplicantPath roleSlug="sdr-placement" />
      </Section>

      <Section id="faq" headline="Questions about the role">
        <FaqList items={faqs} />
      </Section>

      {/* The application. It lands in the admin's Applicants inbox, the same
          one every Sales Operator posting uses. */}
      <section id="apply" className={cn(gutter, 'scroll-mt-24 border-t border-c-line py-20 sm:py-28')}>
        <div className="mx-auto max-w-3xl">
          <h2 className={cn(sectionTitle, 'mx-auto text-center')}>One job is yours: nobody gets ignored.</h2>
          <p className={cn(lead, 'mx-auto mt-4 text-center')}>If that sounds like the standard you want to be held to, start your application.</p>
          <GlowFrame className="mt-10 !p-0">
            <div className="flex items-center gap-3 border-b border-c-line px-5 py-4 sm:px-7">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-c-ink text-sm font-semibold text-white">2</span>
              <div>
                <h3 className="text-base font-medium tracking-tight text-c-ink sm:text-lg">Apply for the SDR Placement Role</h3>
                <p className="text-xs text-c-muted">Complete the form below to submit your application</p>
              </div>
            </div>
            <ApplicationForm roleSlug="sdr-placement" jobTitle="SDR Placement Role" />
          </GlowFrame>
          <div className="mt-6 text-center">
            <Link href="/hiring#positions" className="text-sm font-medium text-c-muted underline-offset-4 hover:text-c-ink hover:underline">
              See all open roles
            </Link>
          </div>
        </div>
      </section>

      <CareersFooter />
    </CareersShell>
  );
}
