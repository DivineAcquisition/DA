'use client';

import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { setAvailabilityAction } from '@/lib/portal/actions';
import type { AvailabilityData, AvailabilityWindow } from '@/lib/portal/types';
import { inputClass, labelClass, selectClass } from '../../components/ui';
import { Card, CardTitle, Feedback, useAction, VaFieldset } from './portal';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const ZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Berlin', 'Africa/Lagos', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Manila',
  'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];

/** The shift windows a VA can work, in their own time zone. DA sees these when placing people. */
export default function AvailabilityEditor({ data }: { data: AvailabilityData }) {
  const [zone, setZone] = useState(data.time_zone);
  const [windows, setWindows] = useState<AvailabilityWindow[]>(data.windows);
  const action = useAction();

  const update = (index: number, patch: Partial<AvailabilityWindow>) =>
    setWindows(windows.map((w, i) => (i === index ? { ...w, ...patch } : w)));

  return (
    <Card>
      <CardTitle>When you can work</CardTitle>
      <p className="mb-4 text-sm text-neutral-400">
        Add each window you can reliably work. DA uses this to match you to a placement; it is not a promise of shifts.
      </p>
      <VaFieldset>
        <label className="block">
          <span className={labelClass}>Your time zone</span>
          <select value={zone} onChange={(e) => setZone(e.target.value)} className={selectClass}>
            {(ZONES.includes(zone) ? ZONES : [zone, ...ZONES]).map((z) => (
              <option key={z} value={z}>
                {z.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <ul className="mt-4 space-y-2">
          {windows.length === 0 ? <li className="text-sm text-neutral-500">No windows yet.</li> : null}
          {windows.map((w, i) => (
            <li key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
              <label>
                <span className="sr-only">Day</span>
                <select value={w.iso_day} onChange={(e) => update(i, { iso_day: Number(e.target.value) })} className={selectClass}>
                  {DAYS.map((d, idx) => (
                    <option key={d} value={idx + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">From</span>
                <input type="time" value={w.starts} onChange={(e) => update(i, { starts: e.target.value })} className={inputClass} />
              </label>
              <label>
                <span className="sr-only">To</span>
                <input type="time" value={w.ends} onChange={(e) => update(i, { ends: e.target.value })} className={inputClass} />
              </label>
              <button
                type="button"
                onClick={() => setWindows(windows.filter((_, idx) => idx !== i))}
                className="rounded-full px-2 py-2 text-sm text-neutral-400 hover:text-white"
                aria-label="Remove window"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWindows([...windows, { iso_day: 1, starts: '09:00', ends: '17:00' }])}
            className={`${btnSecondary} ${btnSizeSm}`}
          >
            Add a window
          </button>
          <button
            type="button"
            disabled={action.pending}
            onClick={() => action.run(() => setAvailabilityAction(windows, zone))}
            className={`${btnPrimary} ${btnSizeSm}`}
          >
            Save availability
          </button>
        </div>
      </VaFieldset>
      <Feedback message={action.message} error={action.error} />
    </Card>
  );
}
