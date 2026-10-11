import type { ReactNode } from 'react';
import Panel from './Panel';

/** Same frame as the rest of the Academy: Magic card, shine border, optional beam. */
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
    <Panel beam={beam} className={className}>
      {children}
    </Panel>
  );
}
