'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { btnPrimary, btnSecondary, btnSizeMd } from '@/app/components/ui';
import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import { saveAuditDebriefAction } from '@/lib/calls/actions';
import {
  DEBRIEF_CALL_TYPES,
  DEBRIEF_OBJECTIONS,
  DEBRIEF_OUTCOMES,
  DEBRIEF_OWNERS,
  DEBRIEF_TIMELINES,
} from '@/lib/calls/config';
import { recordingPrefillFrom } from '@/lib/calls/overlay';
import type { DebriefRecord, IncomingCall, LeadRecord } from '@/lib/calls/types';
import LeadPicker from './LeadPicker';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 sm:px-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">{title}</h3>
      {children}
    </section>
  );
}

export default function AuditForm({
  lead,
  debrief,
  incomingCall,
  today,
}: {
  lead?: LeadRecord | null;
  debrief?: DebriefRecord | null;
  incomingCall?: IncomingCall | null;
  today: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const recordingPrefill = recordingPrefillFrom(
    incomingCall,
    lead?.googleMeetUrl,
    debrief?.recordingLink,
  );

  const submit = (intent: 'draft' | 'complete') => (formData: FormData) => {
    formData.set('intent', intent);
    setError(null);
    startTransition(async () => {
      const result = await saveAuditDebriefAction(formData);
      if (result && !result.ok) setError(result.error);
    });
  };

  return (
    <form className="space-y-5">
      <LeadPicker initialLead={lead} />
      {debrief && <input type="hidden" name="debriefId" value={debrief.recordId} />}

      <Section title="Section 1 — Which call">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Call date">
            <input name="callDate" type="date" required defaultValue={debrief?.callDate || today} className={inputClass} />
          </Field>
          <Field label="Call type">
            <select name="callType" defaultValue={debrief?.callType || 'Discovery'} className={inputClass}>
              <option value="">Select…</option>
              {DEBRIEF_CALL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Owner">
            <select name="owner" defaultValue={debrief?.owner || 'Malik'} className={inputClass}>
              <option value="">Select…</option>
              {DEBRIEF_OWNERS.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Section 2 — What they said">
        <Field label="Stated goal" hint="Their words, verbatim. Not a paraphrase.">
          <textarea name="statedGoal" rows={3} defaultValue={debrief?.statedGoal} className={`${inputClass} resize-y`} />
        </Field>
        <Field label="Current situation" hint="The situation as they described it. Numbers if they gave any.">
          <textarea
            name="currentSituation"
            rows={3}
            defaultValue={debrief?.currentSituation}
            className={`${inputClass} resize-y`}
          />
        </Field>
        <Field label="What they've tried" hint="And what happened when they did. This predicts the objection.">
          <textarea
            name="whatTheyTried"
            rows={3}
            defaultValue={debrief?.whatTheyTried}
            className={`${inputClass} resize-y`}
          />
        </Field>
        <Field label="Why now" hint="The trigger event. Usually the actual close.">
          <textarea name="whyNow" rows={3} defaultValue={debrief?.whyNow} className={`${inputClass} resize-y`} />
        </Field>
      </Section>

      <Section title="Section 3 — The deal">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Outcome" hint="Required to mark complete. Routes follow-up.">
            <select name="outcome" defaultValue={debrief?.outcome || ''} className={inputClass}>
              <option value="">Select…</option>
              {DEBRIEF_OUTCOMES.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Objection">
            <select name="objection" defaultValue={debrief?.objection || ''} className={inputClass}>
              <option value="">Select…</option>
              {DEBRIEF_OBJECTIONS.map((objection) => (
                <option key={objection} value={objection}>
                  {objection}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount quoted">
            <input
              name="amountQuoted"
              type="number"
              min={0}
              step="1"
              defaultValue={debrief?.amountQuoted ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label="Their timeline">
            <select name="theirTimeline" defaultValue={debrief?.theirTimeline || ''} className={inputClass}>
              <option value="">Select…</option>
              {DEBRIEF_TIMELINES.map((timeline) => (
                <option key={timeline} value={timeline}>
                  {timeline}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Decision makers" hint="By role, not just name.">
          <textarea
            name="decisionMakers"
            rows={2}
            defaultValue={debrief?.decisionMakers}
            className={`${inputClass} resize-y`}
          />
        </Field>
      </Section>

      <Section title="Section 4 — The next move">
        <Field label="Agreed next step" hint="Required to mark complete. What THEY committed to.">
          <textarea
            name="agreedNextStep"
            rows={3}
            defaultValue={debrief?.agreedNextStep}
            className={`${inputClass} resize-y`}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Next step date">
            <input name="nextStepDate" type="date" defaultValue={debrief?.nextStepDate} className={inputClass} />
          </Field>
          <Field label="Close confidence">
            <select name="closeConfidence" defaultValue={debrief?.closeConfidence ?? ''} className={inputClass}>
              <option value="">Select…</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Deal risk" hint="Required to mark complete. One honest sentence.">
          <textarea name="dealRisk" rows={3} defaultValue={debrief?.dealRisk} className={`${inputClass} resize-y`} />
        </Field>
        <Field
          label="Recording link"
          hint="Prefills from the booked Meet when Supabase already has it. Link only — no upload."
        >
          <input
            name="recordingLink"
            type="url"
            defaultValue={recordingPrefill}
            placeholder="https://drive.google.com/…"
            className={inputClass}
          />
        </Field>
        <Field
          label="Transcript"
          hint="Paste Meet's transcript if it did not arrive through Supabase. Attach later from the profile if it is not ready."
        >
          <textarea
            name="transcript"
            rows={6}
            defaultValue={debrief?.transcript || incomingCall?.transcript || ''}
            className={`${inputClass} resize-y`}
          />
        </Field>
      </Section>

      {error && (
        <p className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className={`${btnSecondary} ${btnSizeMd}`}
          formAction={submit('draft')}
        >
          {pending ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="submit"
          disabled={pending}
          className={`${btnPrimary} ${btnSizeMd}`}
          formAction={submit('complete')}
        >
          {pending ? 'Saving…' : debrief ? 'Mark complete' : 'Submit debrief'}
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Drafts write the same Call Debriefs record after landing in Supabase. Completing later
        patches that record — it does not create a second one. Airtable automations fire on the
        first create.
      </p>
    </form>
  );
}
