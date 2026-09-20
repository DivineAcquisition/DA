'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { BorderBeam } from '@/components/ui/border-beam';
import { Panel } from '@/components/ui/panel';
import {
  AD_SPEND_OPTIONS,
  FOLLOW_UP_OPTIONS,
  PROGRAM_PRICE_OPTIONS,
  type QualificationInput,
} from '@/lib/acq/qualify';
import { ACQ_PIXEL_LEAD_EVENT, type TrackingParamKey } from '@/lib/acq/config';
import { PRACTICES } from '@/lib/acq/copy';
import { trackPixel } from './MetaPixel';

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-neutral-600 transition-colors focus:border-brand-500/60 focus:bg-white/[0.05] focus:outline-none';
const labelClass = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500';

function SelectChevron() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m8 9 4-4 4 4m0 6-4 4-4-4" />
    </svg>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function PracticesForm({
  tracking,
}: {
  tracking: Partial<Record<TrackingParamKey, string>>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const input: QualificationInput = {
      fullName: String(form.get('fullName') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      companyName: String(form.get('companyName') ?? ''),
      adSpend: String(form.get('adSpend') ?? ''),
      followUp: String(form.get('followUp') ?? ''),
      programPrice: String(form.get('programPrice') ?? ''),
      website: String(form.get('website') ?? ''),
      tracking,
    };

    try {
      const response = await fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!result.ok) {
        setError(result.error || 'We could not submit that just now. Try again in a moment.');
        setPending(false);
        return;
      }
      trackPixel(ACQ_PIXEL_LEAD_EVENT);
      setSubmitted(true);
    } catch {
      setError('We could not submit that just now. Try again in a moment.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Panel className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-3xl p-0">
      <BorderBeam size={80} duration={10} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} />
      <div className="relative flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.02] px-5 py-4 sm:px-7">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-ink-950">
          1
        </span>
        <div className="min-w-0">
          <h2 className="acq-headline truncate text-base font-semibold text-white sm:text-lg">
            {PRACTICES.formTitle}
          </h2>
          <p className="text-xs text-neutral-500">{PRACTICES.formBody}</p>
        </div>
      </div>

      {submitted ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
          </div>
          <h3 className="acq-headline text-xl font-semibold text-white">{PRACTICES.formSuccessTitle}</h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            {PRACTICES.formSuccessBody}
          </p>
        </div>
      ) : (
        <form className="space-y-5 p-5 sm:p-7" onSubmit={onSubmit} noValidate>
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="practices-fullName" label={PRACTICES.formLabels.fullName}>
              <input
                id="practices-fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                placeholder="Jordan Rivera"
                className={fieldClass}
              />
            </Field>
            <Field id="practices-email" label={PRACTICES.formLabels.email}>
              <input
                id="practices-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@practice.com"
                className={fieldClass}
              />
            </Field>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field id="practices-phone" label={PRACTICES.formLabels.phone}>
              <input
                id="practices-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                inputMode="tel"
                placeholder="+1 (555) 000-0000"
                className={fieldClass}
              />
            </Field>
            <Field id="practices-companyName" label={PRACTICES.formLabels.practiceName}>
              <input
                id="practices-companyName"
                name="companyName"
                type="text"
                autoComplete="organization"
                required
                placeholder="Northside Dental"
                className={fieldClass}
              />
            </Field>
          </div>

          <Field id="practices-adSpend" label={PRACTICES.formLabels.adSpend}>
            <div className="relative">
              <select
                id="practices-adSpend"
                name="adSpend"
                required
                defaultValue=""
                className={`${fieldClass} cursor-pointer appearance-none pr-9`}
              >
                <option value="" disabled>
                  Select one
                </option>
                {AD_SPEND_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </Field>

          <Field id="practices-followUp" label={PRACTICES.formLabels.followUp}>
            <div className="relative">
              <select
                id="practices-followUp"
                name="followUp"
                required
                defaultValue=""
                className={`${fieldClass} cursor-pointer appearance-none pr-9`}
              >
                <option value="" disabled>
                  Select one
                </option>
                {FOLLOW_UP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </Field>

          <Field id="practices-programPrice" label={PRACTICES.formLabels.programPrice}>
            <div className="relative">
              <select
                id="practices-programPrice"
                name="programPrice"
                required
                defaultValue=""
                className={`${fieldClass} cursor-pointer appearance-none pr-9`}
              >
                <option value="" disabled>
                  Select one
                </option>
                {PROGRAM_PRICE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </Field>

          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input name="website" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          {error ? (
            <p className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-4 py-3 text-sm leading-relaxed text-flag-critical">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={pending} className="acq-button acq-button-full">
            {pending ? 'Submitting…' : PRACTICES.formSubmit}
          </button>

          <p className="text-center text-xs text-neutral-600">{PRACTICES.formPrivacy}</p>
        </form>
      )}
    </Panel>
  );
}
