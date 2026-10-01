'use client';

import { Input as InputPrimitive } from '@base-ui/react/input';
import type * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = Omit<InputPrimitive.Props & React.RefAttributes<HTMLInputElement>, 'size'> & {
  size?: 'sm' | 'default' | 'lg' | number;
  unstyled?: boolean;
  nativeInput?: boolean;
};

/**
 * COSS Input (Base UI) restyled to Vistrial field chrome: hairline border,
 * ink fill, brand focus. `nativeInput` keeps FormData `name` working on
 * workspace server actions.
 */
export function Input({
  className,
  size = 'default',
  unstyled = false,
  nativeInput = false,
  style,
  ...props
}: InputProps): React.ReactElement {
  const inputClassName = cn(
    'h-auto w-full min-w-0 rounded-[inherit] bg-transparent px-3.5 py-2.5 text-sm text-white leading-normal outline-none placeholder:text-neutral-600',
    size === 'sm' && 'px-3 py-2 text-[13px]',
    size === 'lg' && 'px-4 py-3',
    props.type === 'search' &&
      '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
    props.type === 'file' &&
      'text-neutral-400 file:me-3 file:border-0 file:bg-transparent file:font-medium file:text-white file:text-sm',
  );

  return (
    <span
      className={
        cn(
          !unstyled &&
            'field-control relative inline-flex w-full rounded-xl text-sm has-disabled:opacity-50 has-aria-invalid:border-flag-critical',
          className,
        ) || undefined
      }
      data-size={size}
      data-slot="input-control"
    >
      {nativeInput ? (
        <input
          className={inputClassName}
          data-slot="input"
          size={typeof size === 'number' ? size : undefined}
          style={typeof style === 'function' ? undefined : style}
          {...props}
        />
      ) : (
        <InputPrimitive
          className={inputClassName}
          data-slot="input"
          size={typeof size === 'number' ? size : undefined}
          style={style}
          {...props}
        />
      )}
    </span>
  );
}

export { InputPrimitive };
