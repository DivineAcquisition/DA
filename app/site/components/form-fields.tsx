'use client';

import type { ReactNode } from 'react';
import { Select } from '@base-ui/react/select';
import { AlertCircle, Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

export type Errors = Record<string, string | undefined>;

const control =
  'w-full rounded-xl border bg-[#0f0d17] px-4 text-[15px] text-white placeholder:text-[#aaa4c4]/50 outline-none transition-colors hover:border-[#9a88fc]/45 focus:border-[#c3b6fe]/80 focus:bg-[#120f1c] focus:ring-2 focus:ring-[#9a88fc]/30';

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
        className={cn(control, 'h-12 disabled:opacity-40', error ? 'border-[#f87171]/60' : 'border-[#9a88fc]/20')}
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
        className={cn(control, 'min-h-[110px] resize-y py-3 leading-relaxed', error ? 'border-[#f87171]/60' : 'border-[#9a88fc]/20')}
      />
    </FieldShell>
  );
}

/**
 * A dropdown built on Base UI Select. Single choice by default; with
 * `multiple`, it stays open so several options can be ticked, and the trigger
 * shows what is selected.
 */
type DropdownProps = {
  id: string;
  label: string;
  options: readonly string[];
  error?: string;
  hint?: ReactNode;
  placeholder?: string;
} & (
  | { multiple?: false; value: string; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
);

export function Dropdown(props: DropdownProps) {
  const { id, label, options, error, hint } = props;
  const multiple = props.multiple === true;
  const placeholder = props.placeholder ?? (multiple ? 'Select all that apply' : 'Select one');
  const empty = multiple ? (props.value as string[]).length === 0 : !props.value;

  const summary = (value: unknown) => {
    if (!multiple) return value as string;
    const list = value as string[];
    if (list.length <= 2) return list.join(', ');
    return `${list.slice(0, 2).join(', ')} +${list.length - 2} more`;
  };

  return (
    <div data-field={id}>
      <Select.Root
        id={id}
        name={id}
        items={options.map((option) => ({ value: option, label: option }))}
        multiple={multiple}
        value={multiple ? (props.value as string[]) : props.value || null}
        onValueChange={(next) => {
          if (props.multiple === true) props.onChange(Array.isArray(next) ? (next as string[]) : []);
          else props.onChange(typeof next === 'string' ? next : '');
        }}
      >
        <Select.Label className="text-sm font-medium text-white/90">{label}</Select.Label>
        {hint ? <p className="mt-1 text-[13px] leading-snug text-white/45">{hint}</p> : null}
        {multiple ? <p className="mt-1 text-[13px] leading-snug text-white/45">Select all that apply.</p> : null}
        <Select.Trigger
          data-focus-target
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            control,
            'mt-2 flex h-12 cursor-pointer items-center justify-between gap-3 text-left data-[popup-open]:border-[#c3b6fe]/80 data-[popup-open]:ring-2 data-[popup-open]:ring-[#9a88fc]/30',
            error ? 'border-[#f87171]/60' : 'border-[#9a88fc]/25',
          )}
        >
          <Select.Value className={cn('min-w-0 truncate', empty && 'text-[#aaa4c4]/60')} placeholder={placeholder}>
            {(value: unknown) => (empty ? placeholder : summary(value))}
          </Select.Value>
          <Select.Icon className="shrink-0 text-[#c3b6fe] transition-transform duration-200 [[data-popup-open]_&]:rotate-180">
            <ChevronDown className="size-4" aria-hidden />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-[60] outline-none">
            <Select.Popup
              className="max-h-[min(360px,var(--available-height))] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-y-auto rounded-xl border border-[#9a88fc]/30 bg-[#16131f] p-1.5 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9),0_0_50px_-24px_rgba(154,136,252,0.7)] outline-none transition-[scale,opacity] duration-150 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0"
            >
              <Select.List>
                {options.map((option) => (
                  <Select.Item
                    key={option}
                    value={option}
                    className="grid cursor-pointer grid-cols-[1.25rem_1fr] items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm text-white/80 outline-none select-none data-[highlighted]:bg-[#5a23fc]/25 data-[highlighted]:text-white data-[selected]:text-white"
                  >
                    {multiple ? (
                      <span className="col-start-1 flex size-4 items-center justify-center rounded-[5px] border border-[#9a88fc]/50 [[data-selected]_&]:border-[#c3b6fe] [[data-selected]_&]:bg-[#5a23fc]">
                        <Select.ItemIndicator>
                          <Check className="size-3 text-white" aria-hidden />
                        </Select.ItemIndicator>
                      </span>
                    ) : (
                      <Select.ItemIndicator className="col-start-1">
                        <Check className="size-4 text-[#c3b6fe]" aria-hidden />
                      </Select.ItemIndicator>
                    )}
                    <Select.ItemText className="col-start-2">{option}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex items-start gap-1.5 text-[13px] text-[#fca5a5]">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
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
            checked ? 'border-[#b59aff] bg-[#5a23fc]' : error ? 'border-[#f87171]/70' : 'border-[#9a88fc]/40',
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
    <section className="space-y-6 border-t border-[#9a88fc]/15 pt-8 first:border-t-0 first:pt-0">
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
  const target = root.querySelector<HTMLElement>('[data-focus-target], input:not([type="hidden"]):not([aria-hidden="true"]), textarea');
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
