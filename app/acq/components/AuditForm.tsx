'use client';

import { type FormEvent, type ReactNode, useState } from 'react';
import { FORM_LABELS, QUALIFY_DIALOG } from '@/lib/acq/copy';
import { ACQ_PIXEL_LEAD_EVENT, type TrackingParamKey } from '@/lib/acq/config';
import {
  FOLLOW_UP_OPTIONS,
  PROGRAM_PRICE_OPTIONS,
  type QualificationInput,
} from '@/lib/acq/qualify';
import { trackPixel } from './MetaPixel';

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="acq-headline text-[12px] font-semibold tracking-tight text-white">{label}</span>
      <span className="acq-field mt-1.5 block">{children}</span>
    </label>
  );
}

function SelectChevron() {
  return (
    <svg className="acq-field-chevron" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 6.2 8 10l4-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AuditForm({
  tracking,
}: {
  tracking: Partial<Record<TrackingParamKey, string>>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const input: QualificationInput = {
      fullName: String(form.get('fullName') ?? ''),
      email: String(form.get('email') ?? ''),
      offer: String(form.get('offer') ?? ''),
      programPrice: String(form.get('programPrice') ?? ''),
      inquiriesPerMonth: String(form.get('inquiriesPerMonth') ?? ''),
      followUp: String(form.get('followUp') ?? ''),
      website: String(form.get('website') ?? ''),
      tracking,
    };

    try {
      const response = await fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string; redirectTo?: string };
      if (!result.ok || !result.redirectTo) {
        setError(result.error || 'We could not submit that just now. Try again in a moment.');
        setPending(false);
        return;
      }
      trackPixel(ACQ_PIXEL_LEAD_EVENT);
      window.location.assign(result.redirectTo);
    } catch {
      setError('We could not submit that just now. Try again in a moment.');
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={FORM_LABELS.fullName}>
          <input
            name="fullName"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={200}
            placeholder="Jordan Blake"
            className="acq-field-control"
          />
        </Field>
        <Field label={FORM_LABELS.email}>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@email.com"
            className="acq-field-control"
          />
        </Field>
      </div>
      <Field label={FORM_LABELS.offer}>
        <input
          name="offer"
          type="text"
          required
          minLength={2}
          maxLength={200}
          placeholder="A 12-week coaching program"
          className="acq-field-control"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={FORM_LABELS.programPrice}>
          <select name="programPrice" required defaultValue="" className="acq-field-control acq-field-select">
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
        </Field>
        <Field label={FORM_LABELS.inquiries}>
          <input
            name="inquiriesPerMonth"
            type="number"
            inputMode="numeric"
            required
            min={0}
            max={100000}
            step={1}
            placeholder="12"
            className="acq-field-control"
          />
        </Field>
      </div>
      <Field label={FORM_LABELS.followUp}>
        <select name="followUp" required defaultValue="" className="acq-field-control acq-field-select">
          <option value="" disabled>
            Select one
          </option>
          {FOLLOW_UP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <SelectChevron />
      </Field>

      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {error ? (
        <p className="text-[13px] text-flag-critical" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="acq-button acq-button-full mt-1">
        {pending ? 'Submitting…' : QUALIFY_DIALOG.submit}
      </button>
    </form>
  );
}
