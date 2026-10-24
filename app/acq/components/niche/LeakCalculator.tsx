'use client';

import { useMemo, useState } from 'react';
import { BorderBeam } from '@/components/ui/border-beam';
import { MagicCard } from '@/components/ui/magic-card';
import { NumberTicker } from '@/components/ui/number-ticker';
import type { FrontOfficeContent } from '@/lib/acq/front-office-content';
import { missedLeadCost } from '@/lib/acq/front-office-math';

/**
 * The numbers stay in this component. Nothing here is written to storage or sent.
 */
export function LeakCalculator({ calculator }: { calculator: FrontOfficeContent['calculator'] }) {
  const [value, setValue] = useState('');
  const [missed, setMissed] = useState('');
  const [percent, setPercent] = useState(String(calculator.percentDefault));

  const amount = useMemo(() => {
    if (value.trim() === '' || missed.trim() === '' || percent.trim() === '') return null;
    const parsedValue = Number(value);
    const parsedMissed = Number(missed);
    const parsedPercent = Number(percent);
    if (![parsedValue, parsedMissed, parsedPercent].every(Number.isFinite)) return null;
    return missedLeadCost(parsedValue, parsedMissed, parsedPercent);
  }, [missed, percent, value]);

  return (
    <div className="relative overflow-hidden rounded-3xl" data-calculator="local">
      <BorderBeam size={80} duration={10} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} />
      <MagicCard className="rounded-3xl" contentClassName="niche-calc lx-card">
      <div className="niche-calc-grid">
        <label>
          <span>{calculator.valueLabel}</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/[^\d.]/g, ''))}
          />
        </label>
        <label>
          <span>{calculator.missedLabel}</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            value={missed}
            onChange={(event) => setMissed(event.target.value.replace(/[^\d.]/g, ''))}
          />
        </label>
        <label>
          <span>{calculator.percentLabel}</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            value={percent}
            onChange={(event) => setPercent(event.target.value.replace(/[^\d.]/g, ''))}
          />
        </label>
      </div>
      <p className="niche-calc-result" aria-live="polite">
        {amount == null ? (
          calculator.estimate
        ) : (
          <>
            About $
            <NumberTicker value={amount} startValue={amount} className="niche-calc-figure" /> {calculator.resultAfter}
          </>
        )}
      </p>
      {amount != null ? <p className="niche-calc-note">{calculator.estimate}</p> : null}
      </MagicCard>
    </div>
  );
}
