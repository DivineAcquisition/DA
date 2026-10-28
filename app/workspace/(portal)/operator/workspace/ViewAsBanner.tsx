'use client';

import { exitViewAsAction } from '@/lib/portal/staffActions';

/** Shown on every workspace screen while a manager or DA Admin is viewing as the operator. */
export function ViewAsBanner({ name }: { name: string }) {
  return (
    <form
      action={exitViewAsAction.bind(null, '/workspace/sales-ops')}
      className="sticky top-0 z-40 flex h-[52px] items-center justify-between gap-3 bg-cyan-400 px-4 text-cyan-950"
    >
      <p className="min-w-0 truncate text-sm font-semibold">Viewing as {name}. Read-only. You cannot change their numbers, reports, alerts, or account.</p>
      <button type="submit" className="shrink-0 rounded-full border border-cyan-950 px-3 py-1 text-xs font-bold">
        Exit
      </button>
    </form>
  );
}
