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
          'h-10 w-full cursor-pointer appearance-none rounded-xl border border-white/[0.09] bg-ink-850 px-4 pr-9 text-sm text-card-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition-shadow [color-scheme:dark] focus:border-brand-500/55 focus:ring-[3px] focus:ring-brand-500/20 disabled:opacity-64 sm:h-9',
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
