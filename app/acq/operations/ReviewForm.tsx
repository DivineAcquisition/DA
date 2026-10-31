'use client';

import { useState, type FormEvent } from 'react';
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import { SALES_REVIEW, type SalesReviewLead } from '@/lib/acq/sales-review';
import type { NicheVisit } from '@/lib/acq/niche-tracking';

type Field = 'firstName' | 'phone' | 'email' | 'company' | 'process' | 'smsConsent';

const empty = {
  firstName: '',
  phone: '',
  email: '',
  company: '',
  process: '',
};

export function ReviewForm({ visit }: { visit: NicheVisit }) {
  const [values, setValues] = useState(empty);
  const [smsConsent, setSmsConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  const setField = (key: keyof typeof empty, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await fetch('/api/acq/sales-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          ...values,
          smsConsent,
          website,
          visit,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        field?: Field;
      };
      if (!response.ok || !payload.ok) {
        if (payload.field) setFieldErrors({ [payload.field]: payload.error ?? 'Check this field.' });
        else setError(payload.error ?? 'We could not send that request.');
        return;
      }
      setDone(true);
    } catch {
      setError('We could not send that request. Try again in a moment.');
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="ops-success" role="status">
        <h3>{SALES_REVIEW.form.successTitle}</h3>
        <p>{SALES_REVIEW.form.successBody}</p>
      </div>
    );
  }

  return (
    <form className="ops-form" onSubmit={onSubmit} noValidate>
      <Field
        id="ops-name"
        label={SALES_REVIEW.form.name}
        name="firstName"
        autoComplete="name"
        value={values.firstName}
        error={fieldErrors.firstName}
        onChange={(value) => setField('firstName', value)}
      />
      <Field
        id="ops-email"
        label={SALES_REVIEW.form.email}
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        error={fieldErrors.email}
        onChange={(value) => setField('email', value)}
      />
      <Field
        id="ops-phone"
        label={SALES_REVIEW.form.phone}
        name="phone"
        type="tel"
        autoComplete="tel"
        value={values.phone}
        error={fieldErrors.phone}
        onChange={(value) => setField('phone', value)}
      />
      <Field
        id="ops-company"
        label={SALES_REVIEW.form.company}
        name="company"
        autoComplete="organization"
        value={values.company}
        error={fieldErrors.company}
        onChange={(value) => setField('company', value)}
      />
      <label className="ops-field" htmlFor="ops-process">
        <span>{SALES_REVIEW.form.process}</span>
        <textarea
          id="ops-process"
          name="process"
          rows={4}
          value={values.process}
          aria-invalid={Boolean(fieldErrors.process)}
          onChange={(event) => setField('process', event.target.value)}
        />
        {fieldErrors.process ? <p role="alert">{fieldErrors.process}</p> : null}
      </label>
      <div className="acq-consent">
        <label>
          <input
            name="smsConsent"
            type="checkbox"
            checked={smsConsent}
            aria-invalid={Boolean(fieldErrors.smsConsent)}
            onChange={(event) => {
              setSmsConsent(event.target.checked);
              setFieldErrors((current) => {
                if (!current.smsConsent) return current;
                const next = { ...current };
                delete next.smsConsent;
                return next;
              });
            }}
          />
          <span>
            {SALES_REVIEW.consent}{' '}
            <a href={LEGAL_TERMS_URL}>Terms</a>
            {' | '}
            <a href={LEGAL_PRIVACY_URL}>Privacy Policy</a>
          </span>
        </label>
        {fieldErrors.smsConsent ? <p role="alert">{fieldErrors.smsConsent}</p> : null}
      </div>
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
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
        <p className="ops-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="acq-button" type="submit" disabled={pending}>
        {pending ? SALES_REVIEW.form.pending : SALES_REVIEW.form.submit}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  name,
  value,
  error,
  onChange,
  type = 'text',
  autoComplete,
}: {
  id: string;
  label: string;
  name: keyof SalesReviewLead | 'firstName';
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="ops-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p role="alert">{error}</p> : null}
    </label>
  );
}
