'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import { inputClass } from '@/app/vistrial/components/ui';
import { saveBriefNoteAction } from '@/lib/calls/actions';

export default function BriefNoteForm({
  leadId,
  initialNote,
}: {
  leadId: string;
  initialNote: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await saveBriefNoteAction(formData);
          if (!result.ok) setError(result.error);
          else setSaved(true);
        });
      }}
    >
      <input type="hidden" name="leadId" value={leadId} />
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
          Going into this call
        </span>
        <textarea
          name="note"
          defaultValue={initialNote}
          rows={3}
          placeholder="Third attempt, prior two were voicemail"
          className={`${inputClass} min-h-20 resize-y`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
          {pending ? 'Saving…' : 'Save note'}
        </button>
        {saved && <p className="text-xs text-flag-good">Saved. Nothing else on the lead changed.</p>}
        {error && <p className="text-xs text-flag-critical">{error}</p>}
      </div>
    </form>
  );
}
