'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { MagicCard } from '@/components/ui/magic-card';
import { Panel } from '@/components/ui/panel';
import { CTA_LABEL } from '@/lib/acq/copy';
import { cn } from '@/lib/utils';

export function StatusPill({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/[0.08] px-3.5 py-1.5 text-[12px] font-semibold tracking-tight text-brand-200 sm:text-[13px]">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-70" />
        <span className="relative inline-flex size-1.5 rounded-full bg-brand-400" />
      </span>
      <AnimatedShinyText className="acq-headline mx-0 max-w-none text-[12px] font-semibold tracking-tight text-brand-200 sm:text-[13px] dark:text-brand-200">
        {children}
      </AnimatedShinyText>
    </p>
  );
}

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" />
    </svg>
  );
}

export function BookCta({ href, className = '' }: { href: string; className?: string }) {
  return (
    <a href={href} className={cn('acq-button acq-button-full no-underline max-w-sm', className)}>
      {CTA_LABEL}
      <ArrowIcon />
    </a>
  );
}

export function StepCards({
  items,
}: {
  items: readonly { label: string; body: string }[];
}) {
  return (
    <div className="relative mt-9">
      <div
        aria-hidden
        className="pointer-events-none absolute top-10 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-brand-500/0 via-brand-500/45 to-brand-500/0 md:block"
      />
      <ol className="grid gap-4 md:grid-cols-3">
        {items.map((item, index) => (
          <li key={item.label}>
            <Panel className="h-full overflow-hidden p-0">
              <MagicCard className="rounded-2xl p-6">
                <span className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/12 text-sm font-bold tabular-nums text-brand-200">
                  {index + 1}
                </span>
                <h3 className="acq-headline mt-4 text-base font-semibold text-white">{item.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{item.body}</p>
              </MagicCard>
            </Panel>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function IncludedCards({
  items,
}: {
  items: readonly { title: string; body: string }[];
}) {
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.title}>
          <Panel className="h-full overflow-hidden p-0">
            <MagicCard className="flex h-full items-start gap-3 rounded-2xl p-4 sm:p-5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-500/15 text-brand-300">
                <Check className="size-3.5" aria-hidden />
              </span>
              <div>
                <p className="acq-headline text-[15px] font-semibold leading-snug text-white">{item.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{item.body}</p>
              </div>
            </MagicCard>
          </Panel>
        </li>
      ))}
    </ul>
  );
}
