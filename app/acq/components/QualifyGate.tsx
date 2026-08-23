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
import { submitQualification } from '@/lib/acq/actions';
import { CTA_LABEL, QUALIFY_DIALOG } from '@/lib/acq/copy';
import {
  AD_SPEND_OPTIONS,
  FOLLOW_UP_OPTIONS,
  PROGRAM_PRICE_OPTIONS,
  type QualificationInput,
} from '@/lib/acq/qualify';
import type { TrackingParamKey } from '@/lib/acq/config';

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
      <span className="acq-headline text-[14px] font-semibold tracking-tight text-white">{label}</span>
      <span className="acq-field mt-2 block">{children}</span>
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

export function QualifyButton({ className = '' }: { className?: string }) {
  const ctx = useContext(QualifyContext);
  if (!ctx) {
    throw new Error('QualifyButton must be used inside QualifyProvider');
  }

  return (
    <button type="button" onClick={ctx.open} className={`acq-button ${className}`}>
      {CTA_LABEL}
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
      const result = await submitQualification(input, window.location.host);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
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
      aria-describedby={descId}
      className="acq-dialog"
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={() => {
        if (!pending) setError(null);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="acq-headline text-[12px] font-semibold tracking-tight text-brand-300">
            Founding install
          </p>
          <h2 id={titleId} className="acq-headline mt-2 text-[1.55rem] font-semibold leading-[1.15] tracking-tight text-white">
            {QUALIFY_DIALOG.title}
          </h2>
          <p id={descId} className="mt-2 text-sm leading-relaxed text-neutral-400">
            {QUALIFY_DIALOG.description}
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="min-h-11 min-w-11 rounded-xl text-neutral-500 transition hover:bg-white/[0.05] hover:text-white"
          aria-label="Close"
        >
          <span aria-hidden className="text-xl leading-none">
            ×
          </span>
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-7 grid gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input
              ref={firstFieldRef}
              name="fullName"
              type="text"
              autoComplete="name"
              required
              placeholder="Jordan Blake"
              className="acq-field-control"
            />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              className="acq-field-control"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              inputMode="tel"
              placeholder="(555) 201-8890"
              className="acq-field-control"
            />
          </Field>
          <Field label="Company name">
            <input
              name="companyName"
              type="text"
              autoComplete="organization"
              required
              placeholder="Your company"
              className="acq-field-control"
            />
          </Field>
        </div>
        <Field label="Roughly how much do you spend on ads per month?">
          <select name="adSpend" required defaultValue="" className="acq-field-control acq-field-select">
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
        </Field>
        <Field label="Who handles follow-up on leads that don't book right away?">
          <select name="followUp" required defaultValue="" className="acq-field-control acq-field-select">
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
        </Field>
        <Field label="What's your program priced at?">
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

        <button type="submit" disabled={pending} className="acq-button acq-button-full mt-1">
          {pending ? 'Submitting…' : QUALIFY_DIALOG.submit}
        </button>
      </form>
    </dialog>
  );
}
