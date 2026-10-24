'use client';

import { useId, useState, type FormEvent, type RefObject } from 'react';
import { Field as CossField, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { CONSENT_CALLS, CONSENT_EMAIL, FORM_SUBMIT_NOTE, LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import type { FrontOfficeApplication } from '@/lib/acq/front-office-content';
import { AI_FRONT_OFFICE_KEY, AI_FRONT_OFFICE_OFFER } from '@/lib/ghl/tags';
import type { HeadlineVariant, NicheVisit } from '@/lib/acq/niche-tracking';
import { browserClickIds, trackRoofingBrowser } from '../RoofingPixel';

const fieldLabel = 'mb-1.5 text-sm font-medium normal-case tracking-normal text-neutral-200';
const fieldControl = 'min-h-12 text-base';

export function FrontOfficeDialog({
  dialogRef,
  firstFieldRef,
  application,
  variant,
  visit,
  onClose,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  firstFieldRef: RefObject<HTMLInputElement | null>;
  application: FrontOfficeApplication;
  variant: HeadlineVariant;
  visit: NicheVisit;
  onClose: () => void;
}) {
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState({
    firstName: '',
    phone: '',
    email: '',
    companyName: '',
    businessType: application.defaultBusinessId,
    monthlyRevenue: '',
    weeklyLeads: '',
    biggestLeak: '',
  });
  const [smsConsent, setSmsConsent] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [website, setWebsite] = useState('');

  const leakOptions =
    application.leaksByBusiness[values.businessType] ?? application.leaksByBusiness.shared ?? application.leakOptions;

  const setField = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key] && !(key === 'firstName' && current.fullName)) return current;
      const next = { ...current };
      delete next[key];
      if (key === 'firstName') delete next.fullName;
      return next;
    });
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (values.firstName.trim().length < 2) next.fullName = 'Enter your first name.';
    if ((values.phone.match(/\d/g)?.length ?? 0) < 10) next.phone = 'Enter a valid mobile phone.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Enter a valid email.';
    if (values.companyName.trim().length < 2) next.companyName = 'Enter your company name.';
    if (!application.businesses.some((option) => option.id === values.businessType)) {
      next.businessType = 'Select the type of business you run.';
    }
    if (!application.revenueOptions.some((option) => option.label === values.monthlyRevenue)) {
      next.monthlyRevenue = 'Select your monthly revenue.';
    }
    if (!application.leadsOptions.some((option) => option.label === values.weeklyLeads)) {
      next.weeklyLeads = 'Select how many new leads you get a week.';
    }
    if (!leakOptions.some((option) => option.id === values.biggestLeak)) {
      next.biggestLeak = 'Select where you lose the most jobs.';
    }
    if (!smsConsent) next.smsConsent = 'Agree to calls and texts to continue.';
    if (!emailConsent) next.emailConsent = 'Agree to emails to continue.';
    return next;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError(null);
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length) {
      const order = [
        'fullName',
        'phone',
        'email',
        'companyName',
        'businessType',
        'monthlyRevenue',
        'weeklyLeads',
        'biggestLeak',
        'smsConsent',
        'emailConsent',
      ];
      const first = order.find((key) => next[key]);
      const node = first ? event.currentTarget.querySelector<HTMLElement>(`[data-field="${first}"]`) : null;
      node?.focus();
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          offerKey: AI_FRONT_OFFICE_KEY,
          niche: values.businessType,
          fullName: values.firstName,
          email: values.email,
          phone: values.phone,
          companyName: values.companyName,
          businessType: values.businessType,
          monthlyRevenue: values.monthlyRevenue,
          weeklyLeads: values.weeklyLeads,
          biggestLeak: values.biggestLeak,
          smsConsent,
          emailConsent,
          headlineVariant: variant,
          tracking: visit,
          website,
          eventSourceUrl: window.location.href,
          ...browserClickIds(),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        field?: string;
        redirectTo?: string;
        pixel?: 'Lead' | 'UnqualifiedLead';
        eventId?: string;
      };
      if (!result.ok || !result.redirectTo) {
        if (result.field) setFieldErrors({ [result.field]: result.error || 'Check that field and try again.' });
        setError(result.error || 'We could not submit that just now. Try again in a moment.');
        setPending(false);
        return;
      }
      const pixelParams = { content_name: AI_FRONT_OFFICE_OFFER, content_category: values.businessType };
      if (result.eventId && result.pixel === 'Lead') trackRoofingBrowser('Lead', result.eventId, false, pixelParams);
      else if (result.eventId && result.pixel === 'UnqualifiedLead') {
        trackRoofingBrowser('UnqualifiedLead', result.eventId, true, pixelParams);
      }
      window.location.assign(result.redirectTo);
    } catch {
      setError('We could not submit that just now. Try again in a moment.');
      setPending(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="acq-dialog acq-coaches acq-niche"
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={() => {
        if (!pending) setError(null);
        onClose();
      }}
    >
      <div className="relative z-[1] flex min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="lx-headline mt-0 text-left text-[1.35rem] sm:text-[1.6rem]">
            {application.heading}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (pending) return;
              dialogRef.current?.close();
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            <span aria-hidden className="text-2xl leading-none">
              ×
            </span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="acq-dialog-body mt-5" noValidate aria-busy={pending}>
          <FieldGroup>
            <TextField
              id="ai-first-name"
              label={application.firstName}
              name="firstName"
              field="fullName"
              type="text"
              autoComplete="given-name"
              value={values.firstName}
              error={fieldErrors.fullName}
              inputRef={firstFieldRef}
              onChange={(value) => setField('firstName', value)}
            />
            <TextField
              id="ai-phone"
              label={application.phone}
              name="phone"
              field="phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              error={fieldErrors.phone}
              onChange={(value) => setField('phone', value)}
            />
            <TextField
              id="ai-email"
              label={application.email}
              name="email"
              field="email"
              type="email"
              autoComplete="email"
              value={values.email}
              error={fieldErrors.email}
              onChange={(value) => setField('email', value)}
            />
            <TextField
              id="ai-company"
              label={application.company}
              name="companyName"
              field="companyName"
              type="text"
              autoComplete="organization"
              value={values.companyName}
              error={fieldErrors.companyName}
              onChange={(value) => setField('companyName', value)}
            />
            <SelectField
              id="ai-business"
              label={application.businessLabel}
              name="businessType"
              field="businessType"
              value={values.businessType}
              placeholder={application.businessPlaceholder}
              error={fieldErrors.businessType}
              options={application.businesses.map((option) => ({ value: option.id, label: option.label }))}
              onChange={(value) => setField('businessType', value)}
            />
            <SelectField
              id="ai-revenue"
              label={application.revenueLabel}
              name="monthlyRevenue"
              field="monthlyRevenue"
              value={values.monthlyRevenue}
              placeholder={application.revenuePlaceholder}
              error={fieldErrors.monthlyRevenue}
              options={application.revenueOptions.map((option) => ({ value: option.label, label: option.label }))}
              onChange={(value) => setField('monthlyRevenue', value)}
            />
            <SelectField
              id="ai-leads"
              label={application.leadsLabel}
              name="weeklyLeads"
              field="weeklyLeads"
              value={values.weeklyLeads}
              placeholder={application.leadsPlaceholder}
              error={fieldErrors.weeklyLeads}
              options={application.leadsOptions.map((option) => ({ value: option.label, label: option.label }))}
              onChange={(value) => setField('weeklyLeads', value)}
            />
            <SelectField
              id="ai-leak"
              label={application.leakLabel}
              name="biggestLeak"
              field="biggestLeak"
              value={values.biggestLeak}
              placeholder={application.leakPlaceholder}
              error={fieldErrors.biggestLeak}
              options={leakOptions.map((option) => ({ value: option.id, label: option.label }))}
              onChange={(value) => setField('biggestLeak', value)}
            />

            <label className="acq-consent">
              <input
                name="smsConsent"
                data-field="smsConsent"
                type="checkbox"
                checked={smsConsent}
                onChange={(event) => {
                  setSmsConsent(event.target.checked);
                  setFieldErrors((current) => {
                    if (!current.smsConsent) return current;
                    const next = { ...current };
                    delete next.smsConsent;
                    return next;
                  });
                }}
                aria-invalid={Boolean(fieldErrors.smsConsent)}
              />
              <span>
                {CONSENT_CALLS.lead}{' '}
                <a href={LEGAL_TERMS_URL}>Terms</a>
                {' | '}
                <a href={LEGAL_PRIVACY_URL}>Privacy Policy</a>
              </span>
            </label>
            {fieldErrors.smsConsent ? (
              <p className="text-sm text-flag-critical" role="alert">
                {fieldErrors.smsConsent}
              </p>
            ) : null}
            <label className="acq-consent">
              <input
                name="emailConsent"
                data-field="emailConsent"
                type="checkbox"
                checked={emailConsent}
                onChange={(event) => {
                  setEmailConsent(event.target.checked);
                  setFieldErrors((current) => {
                    if (!current.emailConsent) return current;
                    const next = { ...current };
                    delete next.emailConsent;
                    return next;
                  });
                }}
                aria-invalid={Boolean(fieldErrors.emailConsent)}
              />
              <span>{CONSENT_EMAIL}</span>
            </label>
            {fieldErrors.emailConsent ? (
              <p className="text-sm text-flag-critical" role="alert">
                {fieldErrors.emailConsent}
              </p>
            ) : null}

            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </label>
            </div>

            {error ? (
              <p className="text-sm text-flag-critical" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={pending} className="acq-button acq-button-full mt-1 shrink-0">
              {pending ? 'Submitting…' : application.submit}
            </button>
            <p className="acq-submit-note">{FORM_SUBMIT_NOTE}</p>
          </FieldGroup>
        </form>
      </div>
    </dialog>
  );
}

function TextField({
  id,
  label,
  name,
  field,
  type,
  autoComplete,
  value,
  error,
  inputRef,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  field: string;
  type: string;
  autoComplete: string;
  value: string;
  error?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
}) {
  return (
    <CossField>
      <FieldLabel className={fieldLabel} htmlFor={id}>
        {label}
      </FieldLabel>
      <Input
        nativeInput
        ref={inputRef}
        id={id}
        name={name}
        data-field={field}
        type={type}
        inputMode={type === 'tel' ? 'tel' : type === 'email' ? 'email' : undefined}
        autoComplete={autoComplete}
        autoCapitalize={type === 'email' ? 'none' : 'words'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        size="lg"
        className={fieldControl}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-flag-critical" role="alert">
          {error}
        </p>
      ) : null}
    </CossField>
  );
}

function SelectField({
  id,
  label,
  name,
  field,
  value,
  placeholder,
  error,
  options,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  field: string;
  value: string;
  placeholder: string;
  error?: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <CossField>
      <FieldLabel className={fieldLabel} htmlFor={id}>
        {label}
      </FieldLabel>
      <NativeSelect
        id={id}
        name={name}
        data-field={field}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="min-h-12 text-base sm:h-12"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-flag-critical" role="alert">
          {error}
        </p>
      ) : null}
    </CossField>
  );
}
