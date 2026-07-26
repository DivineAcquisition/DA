'use client';

import { useState } from 'react';
import { inputClass, labelClass } from '@/app/vistrial/components/ui';

const day = (offsetDays: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const monthStart = () => {
  const date = new Date();
  date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
};

/**
 * Period pickers with sensible defaults. The dates are computed on the client so
 * the server render stays pure and does not bake a build-time "today" into the
 * markup.
 */
export default function PeriodInputs({
  preset = 'week',
  idPrefix = '',
}: {
  preset?: 'week' | 'month';
  idPrefix?: string;
}) {
  const [start] = useState(() => (preset === 'month' ? monthStart() : day(-7)));
  const [end] = useState(() => day(0));

  const startId = `${idPrefix}period_start`;
  const endId = `${idPrefix}period_end`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={labelClass} htmlFor={startId}>
          Period start *
        </label>
        <input
          id={startId}
          name="period_start"
          type="date"
          required
          defaultValue={start}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor={endId}>
          Period end *
        </label>
        <input id={endId} name="period_end" type="date" required defaultValue={end} className={inputClass} />
      </div>
    </div>
  );
}
