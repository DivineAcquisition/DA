'use client';

import { useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';

import {
  BUSINESS_TYPES,
  DISCOVERY_FOLLOW_UPS,
  HONEYPOT_FIELD,
  parseDiscovery,
  SALES_CYCLES,
  SOURCES,
  trackFor,
} from '@/lib/site/forms';

import { DIAGNOSTIC_SESSION_KEY } from './diagnostic-form';
import {
  CheckboxField,
  Dropdown,
  focusField,
  FormSection,
  SubmitButton,
  TextArea,
  TextField,
  type Errors,
} from './form-fields';

type Values = Record<string, string | string[] | boolean>;

type Saved = { inquiryId?: string; email?: string; company?: string; businessType?: string };

const noSubscribe = () => () => {};

/** The diagnostic request made in this tab, if any. Read once; it does not change while the page is open. */
function readSaved(): string | null {
  try {
    return sessionStorage.getItem(DIAGNOSTIC_SESSION_KEY);
  } catch {
    return null;
  }
}

const COUNTS = [
  { field: 'qualifiedLast30', label: 'Approximately how many qualified opportunities did you receive in the last 30 days?' },
  { field: 'progressedLast30', label: 'How many progressed to a consultation, discovery call, or estimate?' },
  { field: 'customersLast30', label: 'How many became paying customers?' },
] as const;

const OPERATIONS = [
  { field: 'newOpportunityProcess', label: 'Describe what currently happens when a new opportunity enters your business.' },
  { field: 'qualificationOwner', label: 'Who is responsible for qualifying and following up with prospects?' },
  { field: 'pipelineManagement', label: 'How do you currently manage your sales pipeline?' },
  { field: 'stalledProspects', label: 'What happens when a prospect doesn’t respond or a proposal remains undecided?' },
] as const;

const READINESS = [
  { field: 'tools', label: 'Which tools are involved in your current sales process?' },
  { field: 'disconnected', label: 'Which systems or processes feel disconnected?' },
  { field: 'approver', label: 'Who would approve changes to your sales process?' },
  { field: 'successLooksLike', label: 'What would you want a successful implementation to improve?' },
] as const;

export function DiscoveryForm({ inquiryId }: { inquiryId: string | null }) {
  const [values, setValues] = useState<Values>({ sources: [] });
  const [trap, setTrap] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const savedRaw = useSyncExternalStore(noSubscribe, readSaved, () => null);
  const saved = useMemo<Saved>(() => {
    try {
      return (JSON.parse(savedRaw ?? 'null') as Saved | null) ?? {};
    } catch {
      return {};
    }
  }, [savedRaw]);
  // Who you are comes from the request made in this tab until you change it.
  const prefill: Values = { email: saved.email ?? '', company: saved.company ?? '', businessType: saved.businessType ?? '' };
  const linkedId = inquiryId ?? saved.inquiryId ?? null;

  const current = (key: string) => (key in values ? values[key] : prefill[key]);
  const str = (key: string) => {
    const value = current(key);
    return typeof value === 'string' ? value : '';
  };
  const set = (key: string, value: string | string[] | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const track = trackFor(str('businessType'));
  const followUps = track === 'general' ? [] : DISCOVERY_FOLLOW_UPS[track];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    const body = { ...prefill, ...values, inquiryId: linkedId, [HONEYPOT_FIELD]: trap };

    const local = parseDiscovery(body);
    if (!local.ok && local.error !== 'honeypot') {
      setErrors(local.fields ?? (local.field ? { [local.field]: local.error } : {}));
      if (!local.field) setFormError(local.error);
      focusField(local.field);
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/site/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        field?: string;
        fields?: Record<string, string>;
      };
      if (!response.ok || !result.ok) {
        if (result.field) {
          setErrors(result.fields ?? { [result.field]: result.error });
          focusField(result.field);
        } else {
          setFormError(result.error ?? 'We could not submit your answers. Please try again.');
        }
        return;
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setFormError('We could not reach our server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="da-panel-violet mx-auto max-w-2xl rounded-2xl p-8 text-center sm:p-10">
        <CheckCircle2 className="mx-auto size-10 text-[#52d6a4]" aria-hidden />
        <h2 className="da-display mt-4 text-2xl font-semibold text-white sm:text-3xl">Thank You. Your Business Context Has Been Received.</h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
          We’ll use the information to prepare for your Sales Operations Diagnostic.
        </p>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-white/55">You can add or clarify details during our conversation.</p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="da-form-card relative space-y-8 rounded-2xl p-5 sm:p-8">

      <FormSection step="00" title="Your details">
        <p className="-mt-2 text-[13px] text-white/45">So we can match your answers to your diagnostic.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="email" label="Work email" type="email" inputMode="email" value={str('email')} onChange={(v) => set('email', v)} error={errors.email} autoComplete="email" />
          <TextField id="company" label="Company name" value={str('company')} onChange={(v) => set('company', v)} error={errors.company} autoComplete="organization" />
        </div>
        <Dropdown
          id="businessType"
          label="Which best describes your business?"
          options={BUSINESS_TYPES}
          value={str('businessType')}
          onChange={(v) => set('businessType', v)}
          error={errors.businessType}
        />
      </FormSection>

      <FormSection step="01" title="Business model">
        <TextArea id="primaryServices" label="What are your primary services?" value={str('primaryServices')} onChange={(v) => set('primaryServices', v)} error={errors.primaryServices} rows={3} />
        <TextArea id="mainOffer" label="What is your main offer or service package?" value={str('mainOffer')} onChange={(v) => set('mainOffer', v)} error={errors.mainOffer} rows={3} />
        <TextField
          id="averageDealValue"
          label="What is your approximate average deal or project value?"
          hint="A number or a range, e.g. $8,000 or $5k–$15k."
          value={str('averageDealValue')}
          onChange={(v) => set('averageDealValue', v)}
          error={errors.averageDealValue}
        />
        <Dropdown
          id="salesCycle"
          label="What is your typical sales cycle?"
          options={SALES_CYCLES}
          value={str('salesCycle')}
          onChange={(v) => set('salesCycle', v)}
          error={errors.salesCycle}
        />
      </FormSection>

      <FormSection step="02" title="Sales operations">
        <Dropdown
          multiple
          id="sources"
          label="Where do most new opportunities originate?"
          options={SOURCES}
          value={(values.sources as string[]) ?? []}
          onChange={(v) => set('sources', v)}
          error={errors.sources}
        />
        {OPERATIONS.map(({ field, label }) => (
          <TextArea key={field} id={field} label={label} value={str(field)} onChange={(v) => set(field, v)} error={errors[field]} />
        ))}
      </FormSection>

      <FormSection step="03" title="Sales performance">
        <p className="-mt-2 text-[13px] text-white/45">Optional. Estimates are fine. Mark a figure unknown if you don’t track it.</p>
        <div className="grid gap-5 md:grid-cols-3">
          {COUNTS.map(({ field, label }) => {
            const unknown = values[`${field}Unknown`] === true;
            return (
              <div key={field} className="flex flex-col justify-between gap-2.5">
                <TextField
                  id={field}
                  label={label}
                  inputMode="numeric"
                  optional
                  value={unknown ? '' : str(field)}
                  onChange={(v) => set(field, v)}
                  error={errors[field]}
                  disabled={unknown}
                />
                <CheckboxField id={`${field}Unknown`} checked={unknown} onChange={(v) => set(`${field}Unknown`, v)} small>
                  Unknown
                </CheckboxField>
              </div>
            );
          })}
        </div>
        <TextArea id="biggestLoss" label="Where do you believe the most opportunities are being lost?" value={str('biggestLoss')} onChange={(v) => set('biggestLoss', v)} error={errors.biggestLoss} />
      </FormSection>

      <FormSection step="04" title="Technology & readiness">
        {READINESS.map(({ field, label }) => (
          <TextArea key={field} id={field} label={label} value={str(field)} onChange={(v) => set(field, v)} error={errors[field]} rows={3} />
        ))}
      </FormSection>

      {followUps.length > 0 ? (
        <FormSection step="05" title={track === 'b2b' ? 'For B2B service companies & agencies' : 'For high-end local service businesses'}>
          {followUps.map(({ field, label }) => (
            <TextArea key={field} id={field} label={label} value={str(field)} onChange={(v) => set(field, v)} error={errors[field]} rows={3} />
          ))}
        </FormSection>
      ) : null}

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

      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel="Submitting…">
          Submit my business context
        </SubmitButton>
      </div>
    </form>
  );
}
