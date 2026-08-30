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

/** Particle field used behind hiring heroes. Same brand treatment as acq. */
export function HiringParticles({ className = '' }: { className?: string }) {
  return (
    <Particles
      className={cn('absolute inset-0 z-0', className)}
      quantity={48}
      color="#9A88FC"
      ease={80}
      size={0.5}
    />
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
