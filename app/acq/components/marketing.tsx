'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { MagicCard } from '@/components/ui/magic-card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Panel } from '@/components/ui/panel';
import { ShineBorder } from '@/components/ui/shine-border';
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

export function IncludedCards({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item}>
          <Panel className="h-full overflow-hidden p-0">
            <MagicCard className="flex h-full items-start gap-3 rounded-2xl p-4 sm:p-5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-500/15 text-brand-300">
                <Check className="size-3.5" aria-hidden />
              </span>
              <p className="text-[15px] leading-relaxed text-white">{item}</p>
            </MagicCard>
          </Panel>
        </li>
      ))}
    </ul>
  );
}

export function CaseStudyCallout({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="panel relative mt-8 overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-10 sm:py-14">
      <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} duration={12} />
      <p className="acq-headline relative text-[3.4rem] font-semibold leading-none tracking-tight text-white sm:text-[5rem]">
        $
        <NumberTicker value={value} className="acq-headline font-semibold tracking-tight text-white" />
      </p>
      <p className="relative mt-3 text-sm font-medium uppercase tracking-[0.14em] text-neutral-400 sm:text-[13px]">
        {label}
      </p>
    </div>
  );
}

export function FaqAccordion({
  items,
}: {
  items: readonly { q: string; a: string }[];
}) {
  return (
    <Accordion multiple className="mt-8 divide-y divide-white/[0.07] border-y border-white/[0.07]">
      {items.map((item, index) => (
        <AccordionItem key={item.q} value={`faq-${index}`}>
          <AccordionTrigger className="acq-headline py-5 text-left text-[15px] font-semibold text-white">
            {item.q}
          </AccordionTrigger>
          <AccordionPanel className="max-w-2xl pr-8 text-sm leading-relaxed text-neutral-400">
            {item.a}
          </AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function FinalCtaFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.1] bg-ink-900 px-6 py-12 text-center sm:px-12 sm:py-16',
      )}
    >
      <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} duration={12} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at top, rgba(154,136,252,0.22) 0%, transparent 55%)',
        }}
      />
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}
