'use client';

import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Native `<select>` with Vistrial / COSS dropdown chrome (chevron, ink fill,
 * hairline border). Workspace forms post `<option>` values through FormData;
 * the Base UI combobox Select is not a drop-in for that API.
 */
export function NativeSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): React.ReactElement {
  return (
    <span className="relative block w-full" data-slot="select-control">
      <select
        className={cn(
          'w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-ink-900 px-3.5 py-2.5 pr-9 text-sm text-white outline-none transition-colors focus:border-brand-500/60 focus:bg-white/[0.05] disabled:opacity-50',
          className,
        )}
        data-slot="select"
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-500"
      >
        <svg fill="none" height="12" viewBox="0 0 12 12" width="12">
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      </span>
    </span>
  );
}
