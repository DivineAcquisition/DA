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
            'relative inline-flex w-full rounded-xl border border-[color:var(--field-border)] bg-[var(--field-bg)] text-sm text-[color:var(--strong)] shadow-[inset_0_1px_0_var(--field-highlight)] transition-[border-color,box-shadow] hover:border-[color:var(--field-border-hover)] has-focus-visible:border-brand-500/55 has-focus-visible:ring-[3px] has-focus-visible:ring-brand-500/20 has-disabled:opacity-64 has-aria-invalid:border-destructive/40',
          className,
        ) || undefined
      }
      data-size={size}
      data-slot="textarea-control"
    >
      <textarea
        className={cn(
          'field-sizing-content min-h-28 w-full resize-y rounded-[inherit] border-0 bg-transparent px-4 py-2 text-sm text-[color:var(--strong)] outline-none placeholder:text-muted-foreground/72',
          size === 'sm' && 'min-h-24 px-3 py-2',
          size === 'lg' && 'min-h-36 px-4 py-3',
        )}
        data-slot="textarea"
        {...props}
      />
    </span>
  );
}
