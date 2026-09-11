'use client';

import type * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.ComponentPropsWithoutRef<'textarea'> & {
  size?: 'sm' | 'default' | 'lg';
  unstyled?: boolean;
};

/**
 * COSS-style control wrapper around a native textarea so workspace forms can
 * still post `name` through FormData.
 */
export function Textarea({
  className,
  size = 'default',
  unstyled = false,
  ...props
}: TextareaProps): React.ReactElement {
  return (
    <span
      className={
        cn(
          !unstyled &&
            'relative inline-flex w-full rounded-xl border border-white/10 bg-white/[0.03] text-sm transition-colors has-focus-visible:border-brand-500/60 has-focus-visible:bg-white/[0.05] has-disabled:opacity-50 has-aria-invalid:border-flag-critical/40',
          className,
        ) || undefined
      }
      data-size={size}
      data-slot="textarea-control"
    >
      <textarea
        className={cn(
          'min-h-28 w-full resize-y rounded-[inherit] bg-transparent px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600',
          size === 'sm' && 'min-h-24 px-3 py-2',
          size === 'lg' && 'min-h-36 px-4 py-3',
        )}
        data-slot="textarea"
        {...props}
      />
    </span>
  );
}
