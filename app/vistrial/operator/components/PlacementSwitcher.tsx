'use client';

import { useOps } from '@/lib/vistrial/store';

/**
 * Only appears when an operator holds more than one placement. Everything they
 * log attaches to whichever one is selected here.
 */
export default function PlacementSwitcher() {
  const { gateway, myLivePlacements, activePlacement, setActivePlacement } = useOps();
  if (myLivePlacements.length < 2) return null;

  return (
    <div className="mb-6">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
        Working in
      </p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {myLivePlacements.map((placement) => (
          <button
            key={placement.id}
            type="button"
            onClick={() => setActivePlacement(placement.id)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
              placement.id === activePlacement?.id
                ? 'bg-brand-500/[0.14] text-brand-100 ring-1 ring-inset ring-brand-500/25'
                : 'text-neutral-500 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {gateway.clientName(placement.clientId)}
          </button>
        ))}
      </div>
    </div>
  );
}
