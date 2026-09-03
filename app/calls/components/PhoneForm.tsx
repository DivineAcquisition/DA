'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSizeMd } from '@/app/components/ui';
import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import { logPhoneTouchAction } from '@/lib/calls/actions';
import { TOUCH_CHANNELS, TOUCH_OUTCOMES, TOUCH_SENTIMENTS } from '@/lib/calls/config';
import { recordingPrefillFrom } from '@/lib/calls/overlay';
import type { IncomingCall, LeadRecord } from '@/lib/calls/types';
import LeadPicker from './LeadPicker';

export default function PhoneForm({
  lead,
  incomingCall,
}: {
  lead?: LeadRecord | null;
  incomingCall?: IncomingCall | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const recordingPrefill = recordingPrefillFrom(incomingCall, lead?.googleMeetUrl);
  const [recordingOpen, setRecordingOpen] = useState(Boolean(recordingPrefill));

  return (
    <form
      className="space-y-5"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await logPhoneTouchAction(formData);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <LeadPicker initialLead={lead} />

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={labelClass}>Channel</span>
          <select name="channel" required defaultValue="Call" className={inputClass}>
            {TOUCH_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Outcome</span>
          <select name="outcome" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Select…
            </option>
            {TOUCH_OUTCOMES.map((outcome) => (
              <option key={outcome} value={outcome}>
                {outcome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Sentiment</span>
          <select name="sentiment" required defaultValue="Neutral" className={inputClass}>
            {TOUCH_SENTIMENTS.map((sentiment) => (
              <option key={sentiment} value={sentiment}>
                {sentiment}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>One-line summary</span>
        <input
          name="summary"
          required
          maxLength={280}
          placeholder="Voicemail, will try again tomorrow"
          className={inputClass}
        />
      </label>

      <details
        open={recordingOpen}
        onToggle={(event) => setRecordingOpen(event.currentTarget.open)}
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
      >
        <summary className="cursor-pointer text-sm font-medium text-neutral-300">
          Recording and transcript — optional
        </summary>
        <p className="mt-2 text-xs text-neutral-500">
          Prefills from the booked call when it arrived through Supabase. Paste a transcript if
          Meet did not send one.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className={labelClass}>Recording link</span>
            <input
              name="recordingLink"
              type="url"
              defaultValue={recordingPrefill}
              placeholder="https://drive.google.com/…"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Short transcript</span>
            <textarea
              name="transcript"
              rows={4}
              defaultValue={incomingCall?.transcript || ''}
              className={`${inputClass} resize-y`}
            />
          </label>
        </div>
      </details>

      {error && (
        <p className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeMd}`}>
        {pending ? 'Logging…' : 'Log touch'}
      </button>
    </form>
  );
}
