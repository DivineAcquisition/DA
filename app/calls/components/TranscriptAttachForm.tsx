'use client';

import { useState, useTransition } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import { attachTranscriptAction } from '@/lib/calls/actions';

export default function TranscriptAttachForm({
  leadId,
  debriefId,
}: {
  leadId: string;
  debriefId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-3 space-y-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await attachTranscriptAction(formData);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="debriefId" value={debriefId} />
      <label className="block">
        <span className={labelClass}>Paste transcript</span>
        <textarea name="transcript" rows={5} className={`${inputClass} resize-y`} />
      </label>
      <label className="block">
        <span className={labelClass}>Recording link</span>
        <input name="recordingLink" type="url" placeholder="https://drive.google.com/…" className={inputClass} />
      </label>
      {error && <p className="text-xs text-flag-critical">{error}</p>}
      <button type="submit" disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
        {pending ? 'Attaching…' : 'Attach to this debrief'}
      </button>
    </form>
  );
}
