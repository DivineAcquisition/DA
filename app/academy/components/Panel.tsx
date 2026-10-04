'use client';

import type { ReactNode } from 'react';
import { BorderBeam } from '@/components/ui/border-beam';
import { ShineBorder } from '@/components/ui/shine-border';
import { cn } from '@/lib/utils';

const shine = ['#6A00FF', '#937DFF', '#C3B6FE'];

export default function Panel({
  children,
  className,
  beam = false,
}: {
  children: ReactNode;
  className?: string;
  beam?: boolean;
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-3xl border border-white/10 bg-white/3 shadow-[0_24px_80px_-48px_rgba(106,0,255,0.9)]', className)}>
      <ShineBorder shineColor={shine} borderWidth={1} duration={12} />
      {beam ? <BorderBeam size={80} duration={10} colorFrom="#6A00FF" colorTo="#937DFF" /> : null}
      <div className="relative">{children}</div>
    </div>
  );
}
