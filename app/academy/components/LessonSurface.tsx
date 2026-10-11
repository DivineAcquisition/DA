import type { ReactNode } from 'react';
import { BorderBeam } from '@/components/ui/border-beam';
import { MagicCard } from '@/components/ui/magic-card';
import { ShineBorder } from '@/components/ui/shine-border';

/** Lesson card frame: Magic surface, Coss shine border, and a light beam. */
export function LessonSurface({
  children,
  className = '',
  beam = false,
}: {
  children: ReactNode;
  className?: string;
  beam?: boolean;
}) {
  return (
    <MagicCard className={`overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] ${className}`}>
      <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} borderWidth={1} duration={14} />
      {beam ? <BorderBeam size={90} duration={9} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} /> : null}
      <div className="relative">{children}</div>
    </MagicCard>
  );
}
