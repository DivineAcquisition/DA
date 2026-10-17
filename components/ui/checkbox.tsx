"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import type React from "react";

import { cn } from "@/lib/utils";

/**
 * COSS Checkbox (Base UI). The hidden input keeps `name` on FormData.
 * Restyled to the same hairline / brand fill as the shared Input.
 */
export function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props): React.ReactElement {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "relative mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-white/20 bg-white/[0.04] text-ink-950 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/55 data-checked:border-brand-500 data-checked:bg-brand-500 data-disabled:cursor-not-allowed data-disabled:opacity-64",
        className,
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center text-ink-950"
        data-slot="checkbox-indicator"
      >
        <svg
          aria-hidden="true"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          viewBox="0 0 24 24"
        >
          <path d="m5 13 4 4L19 7" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { CheckboxPrimitive };
