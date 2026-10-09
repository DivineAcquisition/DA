'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Field as CossField, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { CONSENT_CALLS, CONSENT_EMAIL, LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import type { NicheContent } from '@/lib/acq/niche-content';
import { captureVisitAttribution, type HeadlineVariant, type NicheVisit } from '@/lib/acq/niche-tracking';
import { browserClickIds, trackRoofingBrowser } from '../RoofingPixel';

type MarkName = 'hero' | 'final' | 'footer';

type NicheContextValue = {
  open: () => void;
  register: (name: MarkName, node: HTMLElement | null) => void;
  button: string;
};

const NicheContext = createContext<NicheContextValue | null>(null);

function useNiche(): NicheContextValue {
  const value = useContext(NicheContext);
  if (!value) throw new Error('Niche controls must sit inside the roofing page.');
  return value;
}

const fieldLabel = 'mb-1.5 text-sm font-medium normal-case tracking-normal text-neutral-200';
const fieldControl = 'min-h-12 text-base';

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" />
    </svg>
  );
}

export function NicheCta({ mark }: { mark?: 'hero' | 'final' }) {
  const { open, register, button } = useNiche();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mark) return;
    register(mark, ref.current);
    return () => register(mark, null);
  }, [mark, register]);

  return (
    <button ref={ref} type="button" className="acq-button acq-button-full" onClick={open}>
      {button}
      <ArrowIcon />
    </button>
  );
}

export function NicheMark({ name, children }: { name: MarkName; children: ReactNode }) {
  const { register } = useNiche();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    register(name, ref.current);
    return () => register(name, null);
  }, [name, register]);
  return <div ref={ref}>{children}</div>;
}

export function VisitCapture({ tracking }: { tracking: NicheVisit }) {
  useEffect(() => {
    captureVisitAttribution(tracking);
  }, [tracking]);
  return null;
}

export function NicheExperience({
  button,
  form,
  variant,
  tracking,
  children,
}: {
  button: string;
  form: NicheContent['form'];
  variant: HeadlineVariant;
  tracking: NicheVisit;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [marks, setMarks] = useState<Record<MarkName, HTMLElement | null>>({
    hero: null,
    final: null,
    footer: null,
  });
  const [heroVisible, setHeroVisible] = useState(true);
  const [finalVisible, setFinalVisible] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [visit, setVisit] = useState(tracking);

  const register = useCallback((name: MarkName, node: HTMLElement | null) => {
    setMarks((current) => (current[name] === node ? current : { ...current, [name]: node }));
  }, []);

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    setFormOpen(true);
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }, []);

  useEffect(() => {
    setVisit(captureVisitAttribution(tracking));
  }, [tracking]);

  useEffect(() => {
    const openSources = () => {
      if (window.location.hash !== '#sources') return;
      const sources = document.getElementById('sources');
      if (sources instanceof HTMLDetailsElement) sources.open = true;
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('a[href="#sources"]')) return;
      const sources = document.getElementById('sources');
      if (sources instanceof HTMLDetailsElement) sources.open = true;
    };
    openSources();
    window.addEventListener('hashchange', openSources);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', openSources);
      document.removeEventListener('click', onClick);
    };
  }, []);

  useEffect(() => {
    const nodes = [marks.hero, marks.final, marks.footer].filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === marks.hero) setHeroVisible(entry.isIntersecting);
          if (entry.target === marks.final) setFinalVisible(entry.isIntersecting);
          if (entry.target === marks.footer) setFooterVisible(entry.isIntersecting);
        }
      },
      { threshold: 0.2 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [marks]);

  const showSticky = !formOpen && !heroVisible && !finalVisible && !footerVisible;

  return (
    <NicheContext.Provider value={{ open, register, button }}>
      <div className={`acq-coaches acq-niche min-h-screen antialiased${showSticky ? ' niche-has-sticky' : ''}`}>
        {children}
        <div className="niche-sticky" hidden={!showSticky}>
          <button type="button" className="acq-button acq-button-full" onClick={open}>
            {button}
          </button>
        </div>
        <RoofingDialog
          dialogRef={dialogRef}
          firstFieldRef={firstFieldRef}
          form={form}
          variant={variant}
          visit={visit}
          onClose={() => setFormOpen(false)}
        />
      </div>
    </NicheContext.Provider>
  );
}

function RoofingDialog({
  dialogRef,
  firstFieldRef,
  form,
  variant,
  visit,
  onClose,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  firstFieldRef: RefObject<HTMLInputElement | null>;
  form: NicheContent['form'];
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
    spendBand: '',
  });
  const [smsConsent, setSmsConsent] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);
  const [website, setWebsite] = useState('');

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
    if (!form.options.some((option) => option.label === values.spendBand)) {
      next.spendBand = 'Select about how much you spend on paid leads.';
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
      const order = ['fullName', 'phone', 'email', 'companyName', 'spendBand', 'smsConsent', 'emailConsent'];
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
          niche: 'roofing',
          fullName: values.firstName,
          email: values.email,
          phone: values.phone,
          companyName: values.companyName,
          spendBand: values.spendBand,
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
        if (result.field) {
          setFieldErrors({ [result.field]: result.error || 'Check that field and try again.' });
        }
        setError(result.error || 'We could not submit that just now. Try again in a moment.');
        setPending(false);
        return;
      }
      if (result.eventId && result.pixel === 'Lead') trackRoofingBrowser('Lead', result.eventId);
      else if (result.eventId && result.pixel === 'UnqualifiedLead') {
        trackRoofingBrowser('UnqualifiedLead', result.eventId, true);
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
            {form.heading}
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
            <CossField>
              <FieldLabel className={fieldLabel} htmlFor="roof-first-name">
                {form.firstName}
              </FieldLabel>
              <Input
                nativeInput
                ref={firstFieldRef}
                id="roof-first-name"
                name="firstName"
                data-field="fullName"
                type="text"
                autoComplete="given-name"
                autoCapitalize="words"
                value={values.firstName}
                onChange={(event) => setField('firstName', event.target.value)}
                aria-invalid={Boolean(fieldErrors.fullName)}
                aria-describedby={fieldErrors.fullName ? 'roof-first-error' : undefined}
                size="lg"
                className={fieldControl}
              />
              {fieldErrors.fullName ? (
                <p id="roof-first-error" className="mt-1.5 text-sm text-flag-critical" role="alert">
                  {fieldErrors.fullName}
                </p>
              ) : null}
            </CossField>
            <CossField>
              <FieldLabel className={fieldLabel} htmlFor="roof-phone">
                {form.phone}
              </FieldLabel>
              <Input
                nativeInput
                id="roof-phone"
                name="phone"
                data-field="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={values.phone}
                onChange={(event) => setField('phone', event.target.value)}
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? 'roof-phone-error' : undefined}
                size="lg"
                className={fieldControl}
              />
              {fieldErrors.phone ? (
                <p id="roof-phone-error" className="mt-1.5 text-sm text-flag-critical" role="alert">
                  {fieldErrors.phone}
                </p>
              ) : null}
            </CossField>
            <CossField>
              <FieldLabel className={fieldLabel} htmlFor="roof-email">
                {form.email}
              </FieldLabel>
              <Input
                nativeInput
                id="roof-email"
                name="email"
                data-field="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={values.email}
                onChange={(event) => setField('email', event.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'roof-email-error' : undefined}
                size="lg"
                className={fieldControl}
              />
              {fieldErrors.email ? (
                <p id="roof-email-error" className="mt-1.5 text-sm text-flag-critical" role="alert">
                  {fieldErrors.email}
                </p>
              ) : null}
            </CossField>
            <CossField>
              <FieldLabel className={fieldLabel} htmlFor="roof-company">
                {form.company}
              </FieldLabel>
              <Input
                nativeInput
                id="roof-company"
                name="companyName"
                data-field="companyName"
                type="text"
                autoComplete="organization"
                autoCapitalize="words"
                value={values.companyName}
                onChange={(event) => setField('companyName', event.target.value)}
                aria-invalid={Boolean(fieldErrors.companyName)}
                aria-describedby={fieldErrors.companyName ? 'roof-company-error' : undefined}
                size="lg"
                className={fieldControl}
              />
              {fieldErrors.companyName ? (
                <p id="roof-company-error" className="mt-1.5 text-sm text-flag-critical" role="alert">
                  {fieldErrors.companyName}
                </p>
              ) : null}
            </CossField>
            <CossField>
              <FieldLabel className={fieldLabel} htmlFor="roof-spend">
                {form.spendLabel}
              </FieldLabel>
              <select
                id="roof-spend"
                name="spendBand"
                data-field="spendBand"
                value={values.spendBand}
                onChange={(event) => setField('spendBand', event.target.value)}
                aria-invalid={Boolean(fieldErrors.spendBand)}
                aria-describedby={fieldErrors.spendBand ? 'roof-spend-error' : undefined}
              >
                <option value="">{form.spendPlaceholder}</option>
                {form.options.map((option) => (
                  <option key={option.label} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
              {fieldErrors.spendBand ? (
                <p id="roof-spend-error" className="mt-1.5 text-sm text-flag-critical" role="alert">
                  {fieldErrors.spendBand}
                </p>
              ) : null}
            </CossField>

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
              {pending ? 'Submitting…' : form.submit}
            </button>
            <p className="acq-submit-note">
              By submitting, you agree to our <a href={LEGAL_TERMS_URL}>Terms</a> and{' '}
              <a href={LEGAL_PRIVACY_URL}>Privacy Policy</a>, and we&apos;ll email you about your audit. You
              can unsubscribe anytime.
            </p>
          </FieldGroup>
        </form>
      </div>
    </dialog>
  );
}
