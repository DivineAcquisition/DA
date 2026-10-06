'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Field as CossField, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  CONSENT_CALLS,
  CONSENT_EMAIL,
  CTA_LABEL,
  FORM_EMAIL_NOTE,
  FORM_LABELS,
  FORM_PHONE_NOTE,
  LEGAL_PRIVACY_URL,
  LEGAL_TERMS_URL,
  QUALIFY_DIALOG,
} from '@/lib/acq/copy';
import { type QualificationInput } from '@/lib/acq/qualify';
import { ACQ_PIXEL_LEAD_EVENT, type TrackingParamKey } from '@/lib/acq/config';
import { trackPixel } from './MetaPixel';

const fieldLabel = 'mb-1.5 text-sm font-medium normal-case tracking-normal text-neutral-300';
const fieldControl = 'min-h-12 text-base';

type QualifyContextValue = {
  open: () => void;
};

const QualifyContext = createContext<QualifyContextValue | null>(null);

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" />
    </svg>
  );
}

export function QualifyButton({
  className = '',
  children,
  variant = 'solid',
}: {
  className?: string;
  children?: ReactNode;
  variant?: 'solid' | 'nav';
}) {
  const ctx = useContext(QualifyContext);
  if (!ctx) {
    throw new Error('QualifyButton must be used inside QualifyProvider');
  }

  if (variant === 'nav') {
    return (
      <button
        type="button"
        onClick={ctx.open}
        className={`text-sm font-semibold text-brand-200 transition hover:text-white ${className}`}
      >
        {children ?? CTA_LABEL}
      </button>
    );
  }

  return (
    <button type="button" onClick={ctx.open} className={`acq-button acq-button-full max-w-sm ${className}`}>
      {children ?? CTA_LABEL}
      <ArrowIcon />
    </button>
  );
}

export function QualifyProvider({
  children,
  tracking,
}: {
  children: ReactNode;
  tracking: Partial<Record<TrackingParamKey, string>>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }, []);

  return (
    <QualifyContext.Provider value={{ open }}>
      {children}
      <QualifyDialog dialogRef={dialogRef} firstFieldRef={firstFieldRef} tracking={tracking} />
    </QualifyContext.Provider>
  );
}

function QualifyDialog({
  dialogRef,
  firstFieldRef,
  tracking,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  firstFieldRef: RefObject<HTMLInputElement | null>;
  tracking: Partial<Record<TrackingParamKey, string>>;
}) {
  const titleId = useId();
  const descId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (pending) return;
    dialogRef.current?.close();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const input: QualificationInput = {
      fullName: String(form.get('firstName') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      smsConsent: form.get('smsConsent') === 'on',
      emailConsent: form.get('emailConsent') === 'on',
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
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="acq-dialog acq-coaches"
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={() => {
        if (!pending) setError(null);
      }}
    >
      <div className="relative z-[1] flex min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="lx-pill">{QUALIFY_DIALOG.eyebrow}</p>
            <h2 id={titleId} className="lx-headline mt-4 text-left text-[1.35rem] sm:text-[1.6rem]">
              {QUALIFY_DIALOG.title}
            </h2>
            <p id={descId} className="mt-1 text-sm leading-snug text-neutral-400">
              {QUALIFY_DIALOG.description}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            <span aria-hidden className="text-2xl leading-none">
              ×
            </span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="acq-dialog-body mt-5" noValidate>
          <FieldGroup>
          <CossField>
            <FieldLabel className={fieldLabel}>First name</FieldLabel>
            <Input
              nativeInput
              ref={firstFieldRef}
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              placeholder="Jordan"
              size="lg"
              className={fieldControl}
            />
          </CossField>
          <CossField>
            <FieldLabel className={fieldLabel}>{FORM_LABELS.email}</FieldLabel>
            <Input
              nativeInput
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              size="lg"
              inputMode="email"
              className={fieldControl}
            />
            <p className="mt-1.5 text-sm leading-snug text-neutral-400">{FORM_EMAIL_NOTE}</p>
          </CossField>
          <CossField>
            <FieldLabel className={fieldLabel}>{FORM_LABELS.phone}</FieldLabel>
            <Input
              nativeInput
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="(555) 201-8890"
              size="lg"
              inputMode="tel"
              className={fieldControl}
            />
            <p className="mt-1.5 text-sm leading-snug text-neutral-400">{FORM_PHONE_NOTE}</p>
          </CossField>

          <label className="acq-consent">
            <input name="smsConsent" type="checkbox" required />
            <span>
              {CONSENT_CALLS.lead}{' '}
              <a href={LEGAL_TERMS_URL}>Terms</a>
              {' | '}
              <a href={LEGAL_PRIVACY_URL}>Privacy Policy</a>
            </span>
          </label>
          <label className="acq-consent">
            <input name="emailConsent" type="checkbox" required />
            <span>{CONSENT_EMAIL}</span>
          </label>

          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input name="website" type="text" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          {error ? (
            <p className="text-sm text-flag-critical" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={pending} className="acq-button acq-button-full mt-1 shrink-0">
            {pending ? 'Submitting…' : QUALIFY_DIALOG.submit}
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
