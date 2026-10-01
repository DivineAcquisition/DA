import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** DA panel surface used by Vistrial marketing cards. */
export function Panel({
  children,
  className = '',
  as: Component = 'div',
  id,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
  id?: string;
}) {
  return (
    <Component id={id} className={cn('panel rounded-2xl', className)}>
      {children}
    </Component>
  );
}
