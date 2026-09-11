'use client';

import { formatNumberInput, parseNumberInput, parsePercentInput } from '@/lib/workspace/practices';

export function CurrencyInput({
  value,
  onChange,
  large = false,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  large?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div
      className={`flex items-center rounded-xl border border-[#2A2A3A] bg-white/[0.03] ${
        large ? 'px-4 py-3.5' : 'px-3.5 py-2.5'
      }`}
    >
      <span className="mr-1.5 text-[#6E6C80]">$</span>
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const n = parseNumberInput(value);
          onChange(n == null ? '' : formatNumberInput(n));
        }}
        className={`min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-neutral-600 ${
          large ? 'text-2xl font-semibold' : 'text-sm'
        }`}
      />
    </div>
  );
}

export function PercentInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="flex items-center rounded-xl border border-[#2A2A3A] bg-white/[0.03] px-3.5 py-2.5">
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const n = parsePercentInput(value);
          onChange(n == null ? '' : String(n));
        }}
        className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
      />
      <span className="ml-1.5 text-[#6E6C80]">%</span>
    </div>
  );
}
