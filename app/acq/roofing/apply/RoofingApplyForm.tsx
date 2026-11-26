'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { browserClickIds, trackRoofingBrowser } from '@/app/acq/components/RoofingPixel';
import { CheckboxField, Dropdown, focusField, SubmitButton, TextField, type Errors } from '@/app/site/components/form-fields';
import { CONSENT_CALLS, CONSENT_EMAIL, LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import type { NicheContent } from '@/lib/acq/niche-content';
import { captureVisitAttribution, headlineVariantFromUtm, type NicheVisit } from '@/lib/acq/niche-tracking';

type Values = {
  fullName: string;
  phone: string;
  email: string;
  companyName: string;
  spendBand: string;
  smsConsent: boolean;
  emailConsent: boolean;
};

const EMPTY: Values = {
  fullName: '',
  phone: '',
  email: '',
  companyName: '',
  spendBand: '',
  smsConsent: false,
  emailConsent: false,
};

const FIELD_ORDER: (keyof Values)[] = ['fullName', 'phone', 'email', 'companyName', 'spendBand', 'smsConsent', 'emailConsent'];

const link = 'text-[#c3b6fe] underline underline-offset-4';

export function RoofingApplyForm({
  niche,
  form,
  tracking,
  nextNote,
}: {
  niche: NicheContent['id'];
  form: NicheContent['form'];
  tracking: NicheVisit;
  nextNote: string;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [trap, setTrap] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    captureVisitAttribution(tracking);
  }, [tracking]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (values.fullName.trim().length < 2) next.fullName = 'Enter your first name.';
    if ((values.phone.match(/\d/g)?.length ?? 0) < 10) next.phone = 'Enter a valid mobile phone.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Enter a valid email.';
    if (values.companyName.trim().length < 2) next.companyName = 'Enter your company name.';
    if (!form.options.some((option) => option.label === values.spendBand)) {
      next.spendBand = 'Select about how much you spend on paid leads.';
    }
    if (!values.smsConsent) next.smsConsent = 'Agree to calls and texts to continue.';
    if (!values.emailConsent) next.emailConsent = 'Agree to emails to continue.';
    return next;
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    const next = validate();
    setErrors(next);
    const first = FIELD_ORDER.find((key) => next[key]);
    if (first) {
      focusField(first);
      return;
    }

    setPending(true);
    const visit = captureVisitAttribution(tracking);
    try {
      const response = await fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          niche,
          fullName: values.fullName,
          email: values.email,
          phone: values.phone,
          companyName: values.companyName,
          spendBand: values.spendBand,
          smsConsent: values.smsConsent,
          emailConsent: values.emailConsent,
          headlineVariant: headlineVariantFromUtm(visit.utm_content),
          tracking: visit,
          website: trap,
          eventSourceUrl: window.location.href,
          ...browserClickIds(),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        field?: string;
        redirectTo?: string;
        pixel?: 'Lead' | 'UnqualifiedLead';
        eventId?: string;
      };
      if (!result.ok || !result.redirectTo) {
        if (result.field) {
          setErrors({ [result.field]: result.error || 'Check that field and try again.' });
          focusField(result.field);
        } else {
          setFormError(result.error || 'We could not submit that just now. Try again in a moment.');
        }
        setPending(false);
        return;
      }
      if (result.eventId && result.pixel === 'Lead') trackRoofingBrowser('Lead', result.eventId);
      else if (result.eventId && result.pixel === 'UnqualifiedLead') {
        trackRoofingBrowser('UnqualifiedLead', result.eventId, true);
      }
      window.location.assign(result.redirectTo);
    } catch {
      setFormError('We could not reach our server. Check your connection and try again.');
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={pending} className="da-form-card relative space-y-6 rounded-2xl p-5 sm:p-8">
      <h2 className="da-display text-2xl font-semibold text-white sm:text-[1.7rem]">{form.heading}</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="fullName"
          label={form.firstName}
          value={values.fullName}
          onChange={(v) => set('fullName', v)}
          error={errors.fullName}
          autoComplete="given-name"
        />
        <TextField
          id="phone"
          label={form.phone}
          type="tel"
          inputMode="tel"
          value={values.phone}
          onChange={(v) => set('phone', v)}
          error={errors.phone}
          autoComplete="tel"
        />
        <TextField
          id="email"
          label={form.email}
          type="email"
          inputMode="email"
          value={values.email}
          onChange={(v) => set('email', v)}
          error={errors.email}
          autoComplete="email"
        />
        <TextField
          id="companyName"
          label={form.company}
          value={values.companyName}
          onChange={(v) => set('companyName', v)}
          error={errors.companyName}
          autoComplete="organization"
        />
      </div>
      <Dropdown
        id="spendBand"
        label={form.spendLabel}
        placeholder={form.spendPlaceholder}
        options={form.options.map((option) => option.label)}
        value={values.spendBand}
        onChange={(v) => set('spendBand', v)}
        error={errors.spendBand}
      />

      <section className="space-y-4 border-t border-[#9a88fc]/15 pt-6">
        <CheckboxField id="smsConsent" checked={values.smsConsent} onChange={(v) => set('smsConsent', v)} error={errors.smsConsent}>
          {CONSENT_CALLS.lead}{' '}
          <a href={LEGAL_TERMS_URL} className={link}>
            Terms
          </a>
          {' | '}
          <a href={LEGAL_PRIVACY_URL} className={link}>
            Privacy Policy
          </a>
        </CheckboxField>
        <CheckboxField id="emailConsent" checked={values.emailConsent} onChange={(v) => set('emailConsent', v)} error={errors.emailConsent}>
          {CONSENT_EMAIL}
        </CheckboxField>
      </section>

      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" name="website" value={trap} onChange={(event) => setTrap(event.target.value)} />
        </label>
      </div>

      {formError ? (
        <p role="alert" className="rounded-xl border border-[#f87171]/30 bg-[#f87171]/10 px-4 py-3 text-sm text-[#fecaca]">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-white/40">{nextNote}</p>
        <SubmitButton pending={pending} pendingLabel="Submitting…">
          {form.submit}
        </SubmitButton>
      </div>
      <p className="text-xs leading-relaxed text-white/40">
        By submitting, you agree to our{' '}
        <a href={LEGAL_TERMS_URL} className={link}>
          Terms
        </a>{' '}
        and{' '}
        <a href={LEGAL_PRIVACY_URL} className={link}>
          Privacy Policy
        </a>
        , and we&apos;ll email you about your audit. You can unsubscribe anytime.
      </p>
    </form>
  );
}
