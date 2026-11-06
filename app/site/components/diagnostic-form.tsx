'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

import { CONTACT_EMAIL, DIAGNOSTIC_BOOK_PATH, PRIVACY_URL } from '@/lib/site/content';
import {
  BUSINESS_TYPES,
  CONSTRAINTS,
  CRMS,
  DEAL_VALUES,
  HONEYPOT_FIELD,
  MONTHLY_OPPORTUNITIES,
  parseDiagnosticRequest,
  POSITIONS,
  TIMELINES,
} from '@/lib/site/forms';

import {
  CheckboxField,
  ChoiceGroup,
  focusField,
  FormSection,
  MultiChoice,
  SubmitButton,
  TextField,
  type Errors,
} from './form-fields';

/** Kept in this browser tab so the pre-discovery questionnaire can fill in who you are. */
export const DIAGNOSTIC_SESSION_KEY = 'da-diagnostic';

type Values = {
  fullName: string;
  email: string;
  company: string;
  website: string;
  noWebsite: boolean;
  position: string;
  phone: string;
  businessType: string;
  dealValue: string;
  monthlyOpportunities: string;
  constraints: string[];
  crm: string;
  timeline: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
};

const EMPTY: Values = {
  fullName: '',
  email: '',
  company: '',
  website: '',
  noWebsite: false,
  position: '',
  phone: '',
  businessType: '',
  dealValue: '',
  monthlyOpportunities: '',
  constraints: [],
  crm: '',
  timeline: '',
  privacyConsent: false,
  marketingConsent: false,
};

export function DiagnosticForm() {
  const router = useRouter();
  const [values, setValues] = useState<Values>(EMPTY);
  const [trap, setTrap] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [received, setReceived] = useState(false);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    const body = { ...values, [HONEYPOT_FIELD]: trap };

    const local = parseDiagnosticRequest(body);
    if (!local.ok && local.error !== 'honeypot') {
      setErrors(local.fields ?? (local.field ? { [local.field]: local.error } : {}));
      if (!local.field) setFormError(local.error);
      focusField(local.field);
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/site/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        field?: string;
        fields?: Record<string, string>;
        inquiryId?: string | null;
        booking?: boolean;
      };
      if (!response.ok || !result.ok) {
        if (result.field) {
          setErrors(result.fields ?? { [result.field]: result.error });
          focusField(result.field);
        } else {
          setFormError(result.error ?? 'We could not submit your request. Please try again.');
        }
        return;
      }
      try {
        sessionStorage.setItem(
          DIAGNOSTIC_SESSION_KEY,
          JSON.stringify({
            inquiryId: result.inquiryId,
            email: values.email.trim().toLowerCase(),
            company: values.company.trim(),
            businessType: values.businessType,
          }),
        );
      } catch {
        // Private windows can refuse storage. The questionnaire asks again.
      }
      if (result.booking && result.inquiryId) {
        router.push(`${DIAGNOSTIC_BOOK_PATH}?ref=${encodeURIComponent(result.inquiryId)}`);
        return;
      }
      setReceived(true);
    } catch {
      setFormError('We could not reach our server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (received) {
    return (
      <div role="status" className="da-panel-violet rounded-2xl p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-[#52d6a4]" aria-hidden />
        <h2 className="da-display mt-4 text-2xl font-semibold text-white">Your request has been received.</h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/65">
          We’ll review your information and reply by email with the appropriate next step. If anything is time-sensitive, write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#c9bcff] underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="da-panel relative space-y-8 rounded-2xl p-5 sm:p-8">

      <FormSection step="A" title="Contact & business information">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="fullName" label="Full name" value={values.fullName} onChange={(v) => set('fullName', v)} error={errors.fullName} autoComplete="name" />
          <TextField
            id="email"
            label="Work email"
            type="email"
            inputMode="email"
            value={values.email}
            onChange={(v) => set('email', v)}
            error={errors.email}
            autoComplete="email"
          />
          <TextField id="company" label="Company name" value={values.company} onChange={(v) => set('company', v)} error={errors.company} autoComplete="organization" />
          <div>
            <TextField
              id="website"
              label="Company website"
              type="url"
              inputMode="url"
              placeholder="yourcompany.com"
              value={values.website}
              onChange={(v) => set('website', v)}
              error={errors.website}
              autoComplete="url"
              disabled={values.noWebsite}
            />
            <div className="mt-2.5">
              <CheckboxField id="noWebsite" checked={values.noWebsite} onChange={(v) => set('noWebsite', v)} small>
                No website yet
              </CheckboxField>
            </div>
          </div>
        </div>
        <ChoiceGroup id="position" label="Your position" options={POSITIONS} value={values.position} onChange={(v) => set('position', v)} error={errors.position} />
        <TextField
          id="phone"
          label="Phone number"
          type="tel"
          inputMode="tel"
          optional
          value={values.phone}
          onChange={(v) => set('phone', v)}
          error={errors.phone}
          autoComplete="tel"
        />
      </FormSection>

      <FormSection step="B" title="Business qualification">
        <ChoiceGroup
          id="businessType"
          label="Which best describes your business?"
          options={BUSINESS_TYPES}
          value={values.businessType}
          onChange={(v) => set('businessType', v)}
          error={errors.businessType}
        />
        <ChoiceGroup
          id="dealValue"
          label="What is the approximate value of your typical project or customer engagement?"
          options={DEAL_VALUES}
          value={values.dealValue}
          onChange={(v) => set('dealValue', v)}
          error={errors.dealValue}
        />
        <ChoiceGroup
          id="monthlyOpportunities"
          label="How many new sales opportunities does your business typically receive per month?"
          options={MONTHLY_OPPORTUNITIES}
          value={values.monthlyOpportunities}
          onChange={(v) => set('monthlyOpportunities', v)}
          error={errors.monthlyOpportunities}
          columns={3}
        />
        <MultiChoice
          id="constraints"
          label="What is currently limiting your sales process?"
          options={CONSTRAINTS}
          value={values.constraints}
          onChange={(v) => set('constraints', v)}
          error={errors.constraints}
        />
        <ChoiceGroup
          id="crm"
          label="What CRM or sales management system do you currently use?"
          options={CRMS}
          value={values.crm}
          onChange={(v) => set('crm', v)}
          error={errors.crm}
        />
        <ChoiceGroup
          id="timeline"
          label="When would you ideally like to improve your sales operation?"
          options={TIMELINES}
          value={values.timeline}
          onChange={(v) => set('timeline', v)}
          error={errors.timeline}
        />
      </FormSection>

      <section className="space-y-4 border-t border-white/[0.07] pt-8">
        <CheckboxField id="privacyConsent" checked={values.privacyConsent} onChange={(v) => set('privacyConsent', v)} error={errors.privacyConsent}>
          I acknowledge that Divine Acquisition may use the information provided to review and respond to my inquiry in accordance with its{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-[#c9bcff] underline underline-offset-4">
            Privacy Policy
          </a>
          .
        </CheckboxField>
        <CheckboxField id="marketingConsent" checked={values.marketingConsent} onChange={(v) => set('marketingConsent', v)}>
          I would like to receive occasional updates and business insights from Divine Acquisition.
        </CheckboxField>
      </section>

      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Leave this field empty
          <input tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => setTrap(event.target.value)} name={HONEYPOT_FIELD} />
        </label>
      </div>

      {formError ? (
        <p role="alert" className="rounded-xl border border-[#f87171]/30 bg-[#f87171]/10 px-4 py-3 text-sm text-[#fecaca]">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-white/40">Next, you’ll choose a time for your diagnostic.</p>
        <SubmitButton pending={pending} pendingLabel="Submitting…">
          Continue to booking
        </SubmitButton>
      </div>
    </form>
  );
}
