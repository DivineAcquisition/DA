'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

import { CONTACT_EMAIL, PODCAST_BOOK_PATH, PRIVACY_URL } from '@/lib/site/content';
import {
  BUSINESS_TYPES,
  CONSTRAINTS,
  CRMS,
  DEAL_VALUES,
  HONEYPOT_FIELD,
  MONTHLY_OPPORTUNITIES,
  parsePodcastRequest,
  POSITIONS,
  SALES_CYCLES,
  SOURCES,
  TIMELINES,
} from '@/lib/site/forms';

import { CheckboxField, Dropdown, focusField, FormSection, SubmitButton, TextArea, TextField, type Errors } from './form-fields';

type Values = {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  noWebsite: boolean;
  position: string;
  episode: string;
  whyNow: string;
  businessType: string;
  primaryServices: string;
  dealValue: string;
  monthlyOpportunities: string;
  salesCycle: string;
  sources: string[];
  newOpportunityProcess: string;
  qualificationOwner: string;
  crm: string;
  tools: string;
  constraints: string[];
  biggestLoss: string;
  successLooksLike: string;
  timeline: string;
  approver: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
};

const EMPTY: Values = {
  fullName: '',
  email: '',
  phone: '',
  company: '',
  website: '',
  noWebsite: false,
  position: '',
  episode: '',
  whyNow: '',
  businessType: '',
  primaryServices: '',
  dealValue: '',
  monthlyOpportunities: '',
  salesCycle: '',
  sources: [],
  newOpportunityProcess: '',
  qualificationOwner: '',
  crm: '',
  tools: '',
  constraints: [],
  biggestLoss: '',
  successLooksLike: '',
  timeline: '',
  approver: '',
  privacyConsent: false,
  marketingConsent: false,
};

/** One form for a podcast listener: everything the discovery call needs, then booking. */
export function PodcastForm() {
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

    const local = parsePodcastRequest(body);
    if (!local.ok && local.error !== 'honeypot') {
      setErrors(local.fields ?? (local.field ? { [local.field]: local.error } : {}));
      if (!local.field) setFormError(local.error);
      focusField(local.field);
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/site/podcast', {
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
      if (result.booking && result.inquiryId) {
        router.push(`${PODCAST_BOOK_PATH}?ref=${encodeURIComponent(result.inquiryId)}`);
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
        <h2 className="da-display mt-4 text-2xl text-white">Your request has been received.</h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/65">
          We’ll read your answers and reply by email to set a time. If anything is time-sensitive, write to{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#c3b6fe] underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="da-form-card relative space-y-8 rounded-2xl p-5 sm:p-8">
      <FormSection step="A" title="About you">
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
          <TextField
            id="phone"
            label="Best number to reach you"
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={(v) => set('phone', v)}
            error={errors.phone}
            autoComplete="tel"
          />
          <TextField id="company" label="Company name" value={values.company} onChange={(v) => set('company', v)} error={errors.company} autoComplete="organization" />
        </div>
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
        <Dropdown id="position" label="Your position" options={POSITIONS} value={values.position} onChange={(v) => set('position', v)} error={errors.position} />
      </FormSection>

      <FormSection step="B" title="From the podcast">
        <TextField
          id="episode"
          label="Which episode or topic brought you here?"
          optional
          placeholder="If you remember"
          value={values.episode}
          onChange={(v) => set('episode', v)}
          error={errors.episode}
        />
        <TextArea
          id="whyNow"
          label="What made you want to talk now?"
          value={values.whyNow}
          onChange={(v) => set('whyNow', v)}
          error={errors.whyNow}
          rows={3}
        />
      </FormSection>

      <FormSection step="C" title="Your business">
        <Dropdown
          id="businessType"
          label="Which best describes your business?"
          options={BUSINESS_TYPES}
          value={values.businessType}
          onChange={(v) => set('businessType', v)}
          error={errors.businessType}
        />
        <TextArea
          id="primaryServices"
          label="What do you sell, and who do you sell it to?"
          value={values.primaryServices}
          onChange={(v) => set('primaryServices', v)}
          error={errors.primaryServices}
          rows={3}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Dropdown
            id="dealValue"
            label="Typical value of a customer or project"
            options={DEAL_VALUES}
            value={values.dealValue}
            onChange={(v) => set('dealValue', v)}
            error={errors.dealValue}
          />
          <Dropdown
            id="monthlyOpportunities"
            label="New sales opportunities per month"
            options={MONTHLY_OPPORTUNITIES}
            value={values.monthlyOpportunities}
            onChange={(v) => set('monthlyOpportunities', v)}
            error={errors.monthlyOpportunities}
          />
          <Dropdown
            id="salesCycle"
            label="From first contact to a yes, usually"
            options={SALES_CYCLES}
            value={values.salesCycle}
            onChange={(v) => set('salesCycle', v)}
            error={errors.salesCycle}
          />
          <Dropdown
            multiple
            id="sources"
            label="Where new opportunities come from"
            options={SOURCES}
            value={values.sources}
            onChange={(v) => set('sources', v)}
            error={errors.sources}
          />
        </div>
      </FormSection>

      <FormSection step="D" title="How sales run today">
        <TextArea
          id="newOpportunityProcess"
          label="When a new lead or inquiry comes in, what happens next?"
          value={values.newOpportunityProcess}
          onChange={(v) => set('newOpportunityProcess', v)}
          error={errors.newOpportunityProcess}
          rows={3}
        />
        <TextArea
          id="qualificationOwner"
          label="Who handles sales calls and follow-up today?"
          value={values.qualificationOwner}
          onChange={(v) => set('qualificationOwner', v)}
          error={errors.qualificationOwner}
          rows={2}
        />
        <Dropdown
          id="crm"
          label="What CRM or sales system do you use?"
          options={CRMS}
          value={values.crm}
          onChange={(v) => set('crm', v)}
          error={errors.crm}
        />
        <TextField
          id="tools"
          label="Other tools in your sales process"
          optional
          placeholder="Calendars, dialers, email, spreadsheets"
          value={values.tools}
          onChange={(v) => set('tools', v)}
          error={errors.tools}
        />
        <Dropdown
          multiple
          id="constraints"
          label="What is limiting your sales process?"
          options={CONSTRAINTS}
          value={values.constraints}
          onChange={(v) => set('constraints', v)}
          error={errors.constraints}
        />
        <TextArea
          id="biggestLoss"
          label="Where do you lose the most opportunities?"
          value={values.biggestLoss}
          onChange={(v) => set('biggestLoss', v)}
          error={errors.biggestLoss}
          rows={3}
        />
      </FormSection>

      <FormSection step="E" title="What you want from the call">
        <TextArea
          id="successLooksLike"
          label="If we worked together, what should be different in 90 days?"
          value={values.successLooksLike}
          onChange={(v) => set('successLooksLike', v)}
          error={errors.successLooksLike}
          rows={3}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Dropdown
            id="timeline"
            label="When would you like to make changes?"
            options={TIMELINES}
            value={values.timeline}
            onChange={(v) => set('timeline', v)}
            error={errors.timeline}
          />
          <TextField
            id="approver"
            label="Who else is part of the decision?"
            placeholder="Just me, a partner, a team lead"
            value={values.approver}
            onChange={(v) => set('approver', v)}
            error={errors.approver}
          />
        </div>
      </FormSection>

      <section className="space-y-4 border-t border-[#9a88fc]/15 pt-8">
        <CheckboxField id="privacyConsent" checked={values.privacyConsent} onChange={(v) => set('privacyConsent', v)} error={errors.privacyConsent}>
          I acknowledge that Divine Acquisition may use the information provided to review and respond to my request in accordance with its{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-[#c3b6fe] underline underline-offset-4">
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
        <p className="text-xs leading-relaxed text-white/40">Next, you’ll choose a time for your 1-on-1.</p>
        <SubmitButton pending={pending} pendingLabel="Submitting…">
          Continue to booking
        </SubmitButton>
      </div>
    </form>
  );
}
