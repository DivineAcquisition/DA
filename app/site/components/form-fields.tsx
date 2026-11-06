'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Check } from 'lucide-react';

import { cn } from '@/lib/utils';

export type Errors = Record<string, string | undefined>;

const control =
  'w-full rounded-xl border bg-white/[0.03] px-4 text-[15px] text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#9a88fc]/70 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#5a23fc]/35';

function FieldShell({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div data-field={id}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm font-medium text-white/90">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-white/40">Optional</span> : null}
      </label>
      {hint ? <p className="mt-1 text-[13px] leading-snug text-white/45">{hint}</p> : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex items-start gap-1.5 text-[13px] text-[#fca5a5]">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  optional,
  hint,
  autoComplete,
  placeholder,
  inputMode,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  optional?: boolean;
  hint?: ReactNode;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'numeric';
  disabled?: boolean;
}) {
  return (
    <FieldShell id={id} label={label} error={error} optional={optional} hint={hint}>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(control, 'h-12 disabled:opacity-40', error ? 'border-[#f87171]/60' : 'border-white/10')}
      />
    </FieldShell>
  );
}

export function TextArea({
  id,
  label,
  value,
  onChange,
  error,
  optional,
  hint,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  optional?: boolean;
  hint?: ReactNode;
  rows?: number;
}) {
  return (
    <FieldShell id={id} label={label} error={error} optional={optional} hint={hint}>
      <textarea
        id={id}
        name={id}
        rows={rows}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(control, 'min-h-[110px] resize-y py-3 leading-relaxed', error ? 'border-[#f87171]/60' : 'border-white/10')}
      />
    </FieldShell>
  );
}

/** Single choice shown as selectable chips (a radio group). */
export function ChoiceGroup({
  id,
  label,
  options,
  value,
  onChange,
  error,
  hint,
  columns = 2,
}: {
  id: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset data-field={id} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-sm font-medium text-white/90">{label}</legend>
      {hint ? <p className="mt-1 text-[13px] leading-snug text-white/45">{hint}</p> : null}
      <div className={cn('mt-2.5 grid gap-2', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>
        {options.map((option, index) => {
          const checked = value === option;
          return (
            <label
              key={option}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#9a88fc]',
                checked
                  ? 'border-[#9a88fc]/60 bg-[#5a23fc]/15 text-white'
                  : error
                    ? 'border-[#f87171]/40 bg-white/[0.02] text-white/75 hover:border-white/20'
                    : 'border-white/10 bg-white/[0.02] text-white/75 hover:border-white/20',
              )}
            >
              <input
                type="radio"
                id={index === 0 ? id : undefined}
                name={id}
                value={option}
                checked={checked}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full border',
                  checked ? 'border-[#b59aff] bg-[#5a23fc]' : 'border-white/25',
                )}
              >
                {checked ? <span className="size-1.5 rounded-full bg-white" /> : null}
              </span>
              {option}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex items-start gap-1.5 text-[13px] text-[#fca5a5]">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Several choices shown as chips (a checkbox group). */
export function MultiChoice({
  id,
  label,
  options,
  value,
  onChange,
  error,
  hint,
}: {
  id: string;
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  hint?: ReactNode;
}) {
  const toggle = (option: string) =>
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  return (
    <fieldset data-field={id} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-sm font-medium text-white/90">{label}</legend>
      <p className="mt-1 text-[13px] leading-snug text-white/45">{hint ?? 'Select all that apply.'}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((option, index) => {
          const checked = value.includes(option);
          return (
            <label
              key={option}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#9a88fc]',
                checked
                  ? 'border-[#9a88fc]/60 bg-[#5a23fc]/15 text-white'
                  : error
                    ? 'border-[#f87171]/40 text-white/75 hover:border-white/20'
                    : 'border-white/10 text-white/75 hover:border-white/20',
              )}
            >
              <input
                type="checkbox"
                id={index === 0 ? id : undefined}
                name={id}
                value={option}
                checked={checked}
                onChange={() => toggle(option)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-[5px] border',
                  checked ? 'border-[#b59aff] bg-[#5a23fc]' : 'border-white/25',
                )}
              >
                {checked ? <Check className="size-3 text-white" /> : null}
              </span>
              {option}
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex items-start gap-1.5 text-[13px] text-[#fca5a5]">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function CheckboxField({
  id,
  checked,
  onChange,
  children,
  error,
  small,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  error?: string;
  small?: boolean;
}) {
  return (
    <div data-field={id}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#9a88fc]',
            checked ? 'border-[#b59aff] bg-[#5a23fc]' : error ? 'border-[#f87171]/70' : 'border-white/25',
          )}
        >
          {checked ? <Check className="size-3 text-white" /> : null}
        </span>
        <span className={cn('leading-relaxed text-white/70', small ? 'text-[13px]' : 'text-sm')}>{children}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-2 ml-[30px] flex items-start gap-1.5 text-[13px] text-[#fca5a5]">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormSection({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-6 border-t border-white/[0.07] pt-8 first:border-t-0 first:pt-0">
      <p className="da-mono flex items-center gap-2 text-[11px] tracking-[0.18em] text-white/55 uppercase">
        <span className="text-[#9a88fc]">{step}</span>
        {title}
      </p>
      {children}
    </section>
  );
}

/** Moves focus to the first field with an error so keyboard and screen-reader users land on it. */
export function focusField(field: string | undefined) {
  if (!field) return;
  const root = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
  if (!root) return;
  root.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const target = root.querySelector<HTMLElement>('input, textarea, select');
  window.setTimeout(() => target?.focus({ preventScroll: true }), 250);
}

export function SubmitButton({ pending, children, pendingLabel }: { pending: boolean; children: ReactNode; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="da-btn-primary inline-flex h-12 w-full items-center justify-center rounded-xl px-6 text-[15px] font-medium text-white disabled:cursor-wait disabled:opacity-70 sm:w-auto"
    >
      <span className="relative z-[1]">{pending ? pendingLabel : children}</span>
    </button>
  );
}
