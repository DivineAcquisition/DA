'use client';

import type { ReactNode } from 'react';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { BorderBeam } from '@/components/ui/border-beam';
import { MagicCard } from '@/components/ui/magic-card';
import { Panel } from '@/components/ui/panel';
import { Particles } from '@/components/ui/particles';
import { ShineBorder } from '@/components/ui/shine-border';
import { cn } from '@/lib/utils';
import { eyebrow } from '../../components/ui';
import '../hiring.css';

export const hiringBtn = 'hiring-button';
export const hiringBtnSecondary = 'hiring-button-secondary';
export const hiringBtnSm = 'hiring-button-sm';
export const hiringBtnMd = 'hiring-button-md';
export const hiringBtnLg = 'hiring-button-lg';
export const hiringBtnFull = 'hiring-button-full hiring-button-full-mobile';

/**
 * Grid + particles + brand orbs, scoped to the hero and faded to black.
 * Not a full-page backdrop.
 */
export function HiringHeroBackdrop({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden', className)}>
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(154,136,252,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(154,136,252,0.9) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />
      <div
        className="absolute -top-[30%] left-1/2 h-[640px] w-[1200px] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(154,136,252,0.34) 0%, rgba(102,80,216,0.16) 40%, transparent 72%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="animate-drift absolute -right-32 top-[18%] h-[420px] w-[420px] rounded-full opacity-70"
        style={{
          background: 'radial-gradient(circle, rgba(154,136,252,0.22) 0%, transparent 68%)',
          filter: 'blur(70px)',
        }}
      />
      <div
        className="animate-drift absolute -left-36 top-[42%] h-[380px] w-[380px] rounded-full opacity-60"
        style={{
          background: 'radial-gradient(circle, rgba(102,80,216,0.22) 0%, transparent 68%)',
          filter: 'blur(70px)',
          animationDelay: '2.4s',
        }}
      />
      <Particles className="absolute inset-0" quantity={72} color="#9A88FC" ease={70} size={0.55} />
      <div className="hiring-hero-fade" />
    </div>
  );
}

/** Existing eyebrow pill, with Magic UI shine on the label. */
export function HiringStatusPill({ children }: { children: ReactNode }) {
  return (
    <p className={eyebrow}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
      </span>
      <AnimatedShinyText className="mx-0 max-w-none text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300 dark:text-brand-300">
        {children}
      </AnimatedShinyText>
    </p>
  );
}

/**
 * Coss Panel surface + Magic pointer spotlight.
 * Use for values, listings, mission, about, and step cards.
 */
export function SurfaceCard({
  children,
  className = '',
  cardClassName = '',
  hover = false,
  as,
}: {
  children: ReactNode;
  className?: string;
  cardClassName?: string;
  hover?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Panel as={as} className={cn('overflow-hidden p-0', hover && 'panel-hover', className)}>
      <MagicCard className={cn('relative h-full rounded-[inherit]', cardClassName)}>{children}</MagicCard>
    </Panel>
  );
}

/** Framed embed (VSL / apply iframe) with a traveling brand beam. */
export function BeamFrame({
  children,
  className = '',
  innerClassName = '',
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <div
        aria-hidden
        className="absolute inset-x-6 -bottom-6 top-8 rounded-[2rem] opacity-70 blur-2xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(154,136,252,0.35) 0%, transparent 70%)',
        }}
      />
      <Panel className="relative overflow-hidden rounded-3xl p-1.5 sm:p-2">
        <BorderBeam size={80} duration={8} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} />
        <div className={cn('overflow-hidden rounded-[1.25rem]', innerClassName)}>{children}</div>
      </Panel>
    </div>
  );
}

/** Soft animated edge for featured / closing panels. */
export function ShinePanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn('relative overflow-hidden', className)}>
      <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} borderWidth={1} duration={14} />
      {children}
    </Panel>
  );
}
