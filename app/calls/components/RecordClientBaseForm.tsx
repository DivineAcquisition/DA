'use client';

import { useState, useTransition } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import { recordClientBaseAction } from '@/lib/calls/actions';

const STELLAR_MASTER_URL = 'https://airtable.com/app0I1Krtkcg6SEfd';

export default function RecordClientBaseForm({
  leadId,
  today,
}: {
  leadId: string;
  today: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-4 space-y-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await recordClientBaseAction(formData);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="leadId" value={leadId} />
      <p className="text-xs leading-relaxed text-neutral-500">
        Duplicate{' '}
        <a href={STELLAR_MASTER_URL} className="text-brand-300 hover:underline" target="_blank" rel="noreferrer">
          Stellar Sales Operations — MASTER TEMPLATE
        </a>{' '}
        by hand, then paste the new base here. This tool does not create bases.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelClass}>Client base ID or URL</span>
          <input
            name="baseId"
            required
            placeholder="app… or https://airtable.com/app…"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Base name</span>
          <input name="baseName" required placeholder="Northside Coaching — Stellar" className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Created</span>
          <input name="created" type="date" defaultValue={today} className={inputClass} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
        {pending ? 'Saving…' : 'Save operating base'}
      </button>
      {error && <p className="text-xs text-flag-critical">{error}</p>}
    </form>
  );
}
