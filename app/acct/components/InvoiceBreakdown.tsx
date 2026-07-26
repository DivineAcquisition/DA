'use client';

import { useState } from 'react';
import { Badge } from '@/app/vistrial/components/ui';
import { money } from './dashboard';

/**
 * Every performance invoice can show the individual appointments that produced
 * the amount. That transparency is what stops a billing dispute before it starts.
 */
export default function InvoiceBreakdown({
  lines,
  isPerformance,
}: {
  lines: { id: string; description: string; amount: number; isBooking: boolean }[];
  isPerformance: boolean;
}) {
  const [open, setOpen] = useState(false);
  const bookingLines = lines.filter((line) => line.isBooking).length;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs font-semibold text-brand-300 transition-colors hover:text-brand-200"
      >
        {open ? 'Hide breakdown' : isPerformance ? `Show the ${bookingLines} appointments` : 'Show breakdown'}
      </button>

      {open && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          {isPerformance && (
            <p className="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <Badge tone="good">Confirmed only</Badge>
              Each line is one confirmed appointment. Unverified bookings are never billed.
            </p>
          )}
          <ul className="divide-y divide-white/[0.05]">
            {lines.map((line) => (
              <li key={line.id} className="flex items-baseline justify-between gap-4 py-2">
                <span className="min-w-0 text-[13px] leading-relaxed text-neutral-300">{line.description}</span>
                <span className="shrink-0 text-[13px] tabular-nums text-white">{money(line.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
