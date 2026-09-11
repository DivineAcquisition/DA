'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type React from 'react';
import { cn } from '@/lib/utils';

/** COSS Label with Vistrial uppercase tracking. */
export function Label({
  className,
  render,
  ...props
}: useRender.ComponentProps<'label'>): React.ReactElement {
  const defaultProps = {
    className: cn(
      'mb-1.5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500',
      className,
    ),
    'data-slot': 'label',
  };

  return useRender({
    defaultTagName: 'label',
    props: mergeProps<'label'>(defaultProps, props),
    render,
  });
}
