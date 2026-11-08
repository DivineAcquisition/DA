'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ChevronDown, Menu } from 'lucide-react';
import Logo from '@/app/components/Logo';
import { BlurFade } from '@/components/ui/blur-fade';
import { BorderBeam } from '@/components/ui/border-beam';
import { cn } from '@/lib/utils';
import { interDisplay } from '@/app/workspace/(staff)/components/fonts';
import '@/components/agentic/agentic.css';
import '../careers.css';

/*
 * The careers site: the Vistrial marketing layout (src/lib/marketing/ui.ts,
 * site-header.tsx, saas-frame.tsx, landing.tsx) in the dark lavender palette of
 * the company homepage: Inter Display,
 * a pill nav, lavender gradient buttons, hairline panels with a soft lift, and
 * glow frames with a travelling beam, and the full DivineAcquisition logo.
 */

export const gutter = 'px-5 sm:px-6 lg:px-8';
export const shell = 'mx-auto max-w-6xl';

export const displayTitle =
  'font-careers text-[2.6rem] font-medium leading-[1.05] tracking-[-0.035em] text-c-ink sm:text-6xl sm:leading-[1.04] md:text-[4.1rem] md:leading-[1.02]';
export const heroTitle =
  'font-careers text-[2.25rem] font-medium leading-[1.08] tracking-[-0.03em] text-c-ink sm:text-5xl md:text-[3.25rem] md:leading-[1.05]';
export const sectionTitle =
  'font-careers max-w-3xl text-[1.75rem] font-medium leading-tight tracking-[-0.03em] text-c-ink sm:text-4xl sm:leading-[1.12]';
export const subhead = 'text-[length:15px] leading-relaxed text-c-muted sm:text-lg';
export const lead = 'max-w-2xl text-[length:15px] leading-relaxed text-c-muted sm:text-base';
export const body = 'text-sm leading-relaxed text-c-muted sm:text-[length:15px]';
export const eyebrow = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-c-violet';

/** Solid surfaces: a hairline and a soft lift keep them off the white page. */
export const panel = 'rounded-xl border border-c-line bg-c-card shadow-[0_16px_40px_-24px_rgba(0,0,0,0.7)]';
export const inset = 'rounded-lg border border-c-line bg-c-soft';

const btn =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] border text-[length:15px] font-medium tracking-tight transition-[background-image,box-shadow,transform] outline-none focus-visible:ring-2 focus-visible:ring-[#9a88fc]/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60';
/** Vistrial's gradient button: lavender, dark label, purple lift. */
export const btnPrimary = cn(
  btn,
  'h-12 px-5 border-[#5140a9]/35 bg-gradient-to-b from-[#c3b6fe] via-[#9a88fc] to-[#7e67f2] text-[color:#0b0a11] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_28px_-12px_rgba(154,136,252,0.88)] hover:from-[#d9d1fe] hover:via-[#ae9dfd] hover:to-[#9a88fc] active:translate-y-px',
);
export const btnSecondary = cn(btn, 'h-12 px-5 border-c-line bg-c-card text-c-ink hover:bg-c-soft');
export const btnSm = '!h-10 !px-4 !text-sm';

/** The page: white, Inter Display, with the brand tokens the kit reads. */
export function CareersShell({ children }: { children: ReactNode }) {
  return <div className={cn('careers min-h-screen bg-c-page text-c-ink antialiased', interDisplay.variable)}>{children}</div>;
}

const NAV = [
  { href: '/hiring#positions', label: 'Open roles' },
  { href: '/hiring#how', label: 'How hiring works' },
  { href: '/hiring/sdr-placement', label: 'SDR Placement' },
  { href: '/hiring#faq', label: 'FAQ' },
];

/** Logo left, the nav in a pill, one gradient action right. Sticky, white. */
export function CareersHeader({ action }: { action?: { href: string; label: string } }) {
  const cta = action ?? { href: '/hiring#positions', label: 'See open roles' };
  return (
    <header className={cn('sticky top-0 z-50 border-b border-c-line bg-c-page/90 backdrop-blur', gutter)}>
      <div className={cn(shell, 'flex h-[4.5rem] items-center justify-between gap-4')}>
        <Link href="/hiring" aria-label="Divine Acquisition careers" className="flex shrink-0 items-center gap-2.5 rounded-md">
          <Logo className="h-[22px] w-auto sm:h-[26px]" />
          <span className="hidden rounded-md border border-c-tint-line bg-c-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-c-violet sm:block">
            Careers
          </span>
        </Link>
        <nav aria-label="Careers" className="hidden lg:block">
          <ul className="flex items-center gap-1 rounded-[10px] border border-c-line bg-c-soft/60 p-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="rounded-md px-3 py-1.5 text-sm font-medium text-c-muted transition-colors hover:bg-c-tint hover:text-c-ink">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link href={cta.href} className={cn(btnPrimary, btnSm, 'hidden lg:inline-flex')}>
          {cta.label}
        </Link>
        <details className="relative shrink-0 lg:hidden">
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-c-line bg-c-soft text-c-ink [&::-webkit-details-marker]:hidden">
            <span className="sr-only">Open menu</span>
            <Menu className="size-4" aria-hidden />
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-c-line bg-c-card p-3 shadow-xl">
            <Link href={cta.href} className={cn(btnPrimary, btnSm, 'w-full')}>
              {cta.label}
            </Link>
            <ul className="mt-2 grid">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="block rounded-md px-2.5 py-2 text-sm font-medium text-c-muted hover:bg-c-soft hover:text-c-ink">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </header>
  );
}

const FOOTER = [
  {
    heading: 'Careers',
    links: [
      { href: '/hiring#positions', label: 'Open roles' },
      { href: '/hiring/sdr-placement', label: 'SDR Placement' },
      { href: '/hiring#how', label: 'How hiring works' },
      { href: '/hiring#faq', label: 'FAQ' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: 'https://divineacquisition.io', label: 'Divine Acquisition' },
      { href: 'https://instagram.com/@maliksannie', label: 'Instagram' },
      { href: 'https://x.com/@maliksannie', label: 'X' },
    ],
  },
  {
    heading: 'Legal',
    links: [{ href: 'https://divineacquisition.io/privacy-policy', label: 'Privacy' }],
  },
];

/** The grey footer with link columns. */
export function CareersFooter() {
  return (
    <footer className={cn('border-t border-c-line bg-c-soft', gutter)}>
      <div className={cn(shell, 'grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]')}>
        <div>
          <Logo className="h-[24px] w-auto" />
          <p className="mt-5 max-w-xs text-sm text-c-ink">Acquisition, retention, and growth infrastructure for service businesses.</p>
          <Link href="/hiring#positions" className={cn(btnPrimary, btnSm, 'mt-6')}>
            See open roles
          </Link>
        </div>
        {FOOTER.map((column) => (
          <div key={column.heading}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-c-ink">{column.heading}</p>
            <ul className="mt-4 grid gap-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-sm text-c-muted transition-colors hover:text-c-ink">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className={cn(shell, 'border-t border-c-line py-6 text-xs text-c-muted')}>© {new Date().getFullYear()} Divine Acquisition. All rights reserved.</p>
    </footer>
  );
}

/** A landing section: hairline on top, generous rhythm, fade-in on scroll. */
export function Section({
  id,
  eyebrow: label,
  headline,
  lead: intro,
  children,
  align = 'start',
  className,
}: {
  id?: string;
  eyebrow?: string;
  headline: string;
  lead?: string;
  children: ReactNode;
  align?: 'start' | 'center';
  className?: string;
}) {
  const centered = align === 'center';
  return (
    <section id={id} className={cn(gutter, 'scroll-mt-24 border-t border-c-line py-20 sm:py-28', className)}>
      <BlurFade inView offset={12} blur="2px" duration={0.55} className={shell}>
        {label ? <p className={cn(eyebrow, 'mb-3', centered && 'text-center')}>{label}</p> : null}
        <h2 className={cn(sectionTitle, centered && 'mx-auto text-center')}>{headline}</h2>
        {intro ? <p className={cn(lead, 'mt-4', centered && 'mx-auto text-center')}>{intro}</p> : null}
        <div className="mt-10">{children}</div>
      </BlurFade>
    </section>
  );
}

/** A product frame. Glow adds the purple wash and a beam travelling the edge. */
export function GlowFrame({ children, className, glow = true, beamDelay = 0 }: { children: ReactNode; className?: string; glow?: boolean; beamDelay?: number }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-c-line bg-c-card p-5 sm:p-6',
        glow ? 'shadow-[0_0_72px_-28px_rgba(154,136,252,0.8)]' : 'shadow-[0_24px_50px_-28px_rgba(0,0,0,0.85)]',
        className,
      )}
    >
      {glow ? (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#9a88fc]/20 to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-0 motion-reduce:hidden">
            <BorderBeam delay={beamDelay} duration={8} size={110} borderWidth={1} colorFrom="#9A88FC" colorTo="#C3B6FE" />
          </div>
        </>
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}

/** The window chrome Vistrial puts on its product frames. */
export function FrameDots({ label }: { label?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <span className="flex gap-1.5" aria-hidden>
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-[#7e67f2]" />
      </span>
      {label ? <span className="rounded-full border border-c-line bg-c-soft px-2 py-0.5 text-[11px] text-c-muted">{label}</span> : null}
    </div>
  );
}

export type Faq = { q: string; a: string };

/** Questions in one bordered card, one open at a time. */
export function FaqList({ items }: { items: Faq[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className={cn(panel, 'mx-auto max-w-3xl px-6 sm:px-8')}>
      <ul className="divide-y divide-c-line">
        {items.map((item, index) => {
          const isOpen = open === index;
          return (
            <li key={item.q}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-medium tracking-tight text-c-ink sm:text-[17px]"
                >
                  {item.q}
                  <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-c-muted transition-transform', isOpen && 'rotate-180')} />
                </button>
              </h3>
              {isOpen ? <p className="live-enter pb-5 text-[length:15px] leading-relaxed text-c-muted">{item.a}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A status badge in the Vistrial step cards: done, running, or queued. */
export function StepBadge({ state }: { state: 'done' | 'running' | 'queued' | 'you' }) {
  const look = {
    done: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    running: 'border-c-tint-line bg-c-tint text-[#5140a9]',
    queued: 'border-c-line bg-c-card text-c-muted',
    you: 'border-c-tint-line bg-c-tint text-[#5140a9]',
  }[state];
  const label = { done: 'Done', running: 'In progress', queued: 'Next', you: 'Start here' }[state];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', look)}>
      {state === 'running' ? <span aria-hidden className="size-1.5 rounded-full bg-[#7e67f2] live-pulse" /> : null}
      {label}
    </span>
  );
}
