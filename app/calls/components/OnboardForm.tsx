'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { btnPrimary, btnSizeMd } from '@/app/components/ui';
import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import { submitClientOnboardingAction } from '@/lib/calls/actions';
import type { OnboardPrefill } from '@/lib/calls/types';

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

export default function OnboardForm({
  leadId,
  token,
  prefill,
}: {
  leadId: string;
  token?: string;
  prefill: OnboardPrefill;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const priceHint =
    prefill.programPriceSource === 'quote'
      ? 'From Amount Quoted on the audit debrief — used instead of the application band.'
      : prefill.programPriceSource === 'application'
        ? 'From Program Price on the application. No audit quote was on file.'
        : undefined;

  return (
    <form
      className="space-y-5"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await submitClientOnboardingAction(formData);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="leadId" value={leadId} />
      {token ? <input type="hidden" name="token" value={token} /> : null}

      <Section title="Already known">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <input name="businessName" defaultValue={prefill.businessName} className={inputClass} />
          </Field>
          <Field label="Contact name">
            <input name="contactName" defaultValue={prefill.contactName} className={inputClass} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={prefill.email} className={inputClass} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={prefill.phone} className={inputClass} />
          </Field>
          <Field label="Who handles follow-up today" hint="From Follow-Up Owner on the application.">
            <input name="followUpOwner" defaultValue={prefill.followUpOwner} className={inputClass} />
          </Field>
          <Field label="Program price" hint={priceHint}>
            <input name="programPrice" defaultValue={prefill.programPrice} className={inputClass} />
          </Field>
        </div>
        <Field label="How follow-up works" hint="Elaborated from Current Situation on the audit, when we have it.">
          <textarea
            name="followUpHow"
            rows={4}
            defaultValue={prefill.followUpHow}
            className={`${inputClass} min-h-24 resize-y`}
          />
        </Field>
        <Field label="Decision-maker pattern" hint="From Decision Makers on the audit debrief.">
          <textarea
            name="decisionMakers"
            rows={3}
            defaultValue={prefill.decisionMakers}
            className={`${inputClass} min-h-20 resize-y`}
          />
        </Field>
        <Field
          label="Roughly how many leads come in per month"
          hint="Only if they answered it on the application. Left blank otherwise — we do not guess from ad spend."
        >
          <input name="monthlyLeadVolume" defaultValue={prefill.monthlyLeadVolume} className={inputClass} />
        </Field>
      </Section>

      <Section title="You fill in">
        <p className="text-sm text-neutral-400">
          CRM access, admin logins, existing database size, and training times were never part of
          the audit. They stay blank until you add them.
        </p>
        <Field label="CRM access">
          <textarea name="crmAccess" rows={3} defaultValue={prefill.crmAccess} className={`${inputClass} min-h-20 resize-y`} />
        </Field>
        <Field label="Admin logins">
          <textarea name="adminLogins" rows={3} defaultValue={prefill.adminLogins} className={`${inputClass} min-h-20 resize-y`} />
        </Field>
        <Field label="Existing database size">
          <input name="databaseSize" defaultValue={prefill.databaseSize} className={inputClass} />
        </Field>
        <Field label="Training schedule">
          <textarea
            name="trainingSchedule"
            rows={3}
            defaultValue={prefill.trainingSchedule}
            className={`${inputClass} min-h-20 resize-y`}
          />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeMd}`}>
          {pending ? 'Saving…' : 'Save onboarding'}
        </button>
        {error && <p className="text-sm text-flag-critical">{error}</p>}
      </div>
    </form>
  );
}
