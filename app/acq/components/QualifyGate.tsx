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
import { BorderBeam } from '@/components/ui/border-beam';
import { Field as CossField, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { ShineBorder } from '@/components/ui/shine-border';
import { CTA_LABEL, FORM_LABELS, QUALIFY_DIALOG } from '@/lib/acq/copy';
import {
  FOLLOW_UP_OPTIONS,
  PROGRAM_PRICE_OPTIONS,
  type QualificationInput,
} from '@/lib/acq/qualify';
import { ACQ_PIXEL_LEAD_EVENT, type TrackingParamKey } from '@/lib/acq/config';
import { trackPixel } from './MetaPixel';

const fieldLabel = 'mb-1.5 text-sm font-medium normal-case tracking-normal text-white';
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
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="acq-dialog relative overflow-hidden"
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClose={() => {
        if (!pending) setError(null);
      }}
    >
      <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} borderWidth={1} duration={12} />
      <BorderBeam size={72} duration={8} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} />
      <div className="relative z-[1] flex min-h-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="acq-headline text-[11px] font-semibold tracking-tight text-brand-300">
              {QUALIFY_DIALOG.eyebrow}
            </p>
            <h2 id={titleId} className="acq-headline mt-1 text-[1.25rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-[1.35rem]">
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
          <div className="grid gap-4 md:grid-cols-2">
            <CossField>
              <FieldLabel className={fieldLabel}>{FORM_LABELS.fullName}</FieldLabel>
              <Input
                nativeInput
                ref={firstFieldRef}
                name="fullName"
                type="text"
                autoComplete="name"
                required
                placeholder="Jordan Blake"
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
            </CossField>
          </div>
          <CossField>
            <FieldLabel className={fieldLabel}>{FORM_LABELS.offer}</FieldLabel>
            <Input
              nativeInput
              name="offer"
              type="text"
              required
              minLength={2}
              maxLength={200}
              placeholder="A 12-week coaching program"
              size="lg"
              className={fieldControl}
            />
          </CossField>
          <div className="grid gap-4 md:grid-cols-2">
            <CossField>
              <FieldLabel className={fieldLabel}>{FORM_LABELS.programPrice}</FieldLabel>
              <NativeSelect name="programPrice" required defaultValue="" className="min-h-12 px-4 py-3 text-base">
                <option value="" disabled>
                  Select one
                </option>
                {PROGRAM_PRICE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </CossField>
            <CossField>
              <FieldLabel className={fieldLabel}>{FORM_LABELS.inquiries}</FieldLabel>
              <Input
                nativeInput
                name="inquiriesPerMonth"
                type="number"
                inputMode="numeric"
                required
                min={0}
                max={100000}
                step={1}
                placeholder="12"
                size="lg"
                className={fieldControl}
              />
            </CossField>
          </div>
          <CossField>
            <FieldLabel className={fieldLabel}>{FORM_LABELS.followUp}</FieldLabel>
            <NativeSelect name="followUp" required defaultValue="" className="min-h-12 px-4 py-3 text-base">
              <option value="" disabled>
                Select one
              </option>
              {FOLLOW_UP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </CossField>

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
          </FieldGroup>
        </form>
      </div>
    </dialog>
  );
}
