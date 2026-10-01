'use client';

import type { ReactNode } from 'react';
import { BorderBeam } from '@/components/ui/border-beam';
import { MagicCard } from '@/components/ui/magic-card';
import { Panel } from '@/components/ui/panel';
import { ShineBorder } from '@/components/ui/shine-border';
import { cn } from '@/lib/utils';

/**
 * Hiring surface: Coss panel and the animated edge.
 * Internal cards use this so the app and the careers pages share one material.
 */
export function Surface({
  children,
  className = '',
  shine = true,
  beam = false,
  hover = false,
  as = 'div',
  id,
}: {
  children: ReactNode;
  className?: string;
  shine?: boolean;
  beam?: boolean;
  hover?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
  id?: string;
}) {
  return (
    <Panel as={as} id={id} className={cn('overflow-hidden', hover && 'panel-hover', className)}>
      {shine ? <ShineBorder borderWidth={1} duration={14} shineColor={['#9A88FC', '#C3B6FE']} /> : null}
      {beam ? <BorderBeam size={72} duration={8} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} /> : null}
      <MagicCard className="relative h-full rounded-[inherit]">{children}</MagicCard>
    </Panel>
  );
}

/** Sign-in and gate cards. Beam marks the one panel on an otherwise empty page. */
export function AuthPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Surface beam className={cn('relative z-10 w-full max-w-md rounded-3xl p-6 sm:p-8', className)}>
      {children}
    </Surface>
  );
}
