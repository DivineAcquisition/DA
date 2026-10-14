'use client';

import { useEffect, useMemo, useState } from 'react';
import type { OnboardingAnswer, OnboardingStep } from '@/lib/workspace/onboarding-steps';
import {
  DA_LOGIN_DOMAIN,
  PAYOUT_ONBOARDING_LABELS,
  WEEK_DAYS,
  clockLabel,
  endOptions,
  parseSchedule,
  startOptions,
  toggleMulti,
  weeklyLabel,
  type ScheduleDay,
} from '@/lib/workspace/onboarding-fields';

const inputClass =
  'w-full rounded-xl border border-white/[0.07] bg-ink-800 px-3.5 py-3 text-base text-white outline-none focus:border-brand-400 sm:text-sm';

const choiceClass = 'flex items-center gap-3 rounded-xl border border-white/[0.07] bg-ink-800 px-4 py-3 text-sm text-white';

export function PasswordFields({
  step,
  saved,
  onSave,
}: {
  step: OnboardingStep;
  saved: boolean;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const ready = password.length >= 12 && password === confirm;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ password, confirm });
      }}
    >
      {saved && (
        <p className="text-xs text-flag-good">A password is saved. Enter a new one only if you want to replace it.</p>
      )}
      <input
        id={`input-${step.key}`}
        className={inputClass}
        type="password"
        autoComplete="new-password"
        minLength={12}
        value={password}
        placeholder="At least 12 characters"
        onChange={(event) => setPassword(event.target.value)}
      />
      <input
        className={inputClass}
        type="password"
        autoComplete="new-password"
        minLength={12}
        value={confirm}
        placeholder="Type it again"
        aria-label="Confirm password"
        onChange={(event) => setConfirm(event.target.value)}
      />
      <button
        type="submit"
        disabled={!ready}
        className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 disabled:opacity-40"
      >
        Save password
      </button>
    </form>
  );
}

export function MultiSelectField({
  step,
  draft,
  onDraft,
}: {
  step: OnboardingStep;
  draft: string;
  onDraft: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const exclusive = (step.choices ?? []).some((choice) => choice.value === 'no_preference') ? 'no_preference' : null;
  const selected = new Set(draft.split(',').map((token) => token.trim()).filter(Boolean));
  const shown = (step.choices ?? []).filter((choice) =>
    choice.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <div>
      {(step.choices ?? []).length > 8 && (
        <input
          className={inputClass}
          value={query}
          placeholder={step.placeholder ?? 'Search'}
          aria-label={`Search ${step.label}`}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {selected.size > 0 && (
        <p className="mt-2 text-xs text-neutral-400">
          Selected:{' '}
          {(step.choices ?? [])
            .filter((choice) => selected.has(choice.value))
            .map((choice) => choice.label)
            .join(', ')}
        </p>
      )}
      <div className={`${(step.choices ?? []).length > 8 ? 'mt-2' : ''} max-h-64 space-y-2 overflow-y-auto`} role="group">
        {shown.map((choice) => (
          <label key={choice.value} className={choiceClass}>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={selected.has(choice.value)}
              onChange={() => onDraft(toggleMulti(draft, choice.value, exclusive))}
            />
            {choice.label}
          </label>
        ))}
        {shown.length === 0 && <p className="text-xs text-neutral-500">Nothing matches that search.</p>}
      </div>
    </div>
  );
}

export function ScheduleFields({
  weekly,
  answer,
  onSave,
}: {
  weekly: string;
  answer: OnboardingAnswer | undefined;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const initial = useMemo(() => parseSchedule(answer?.value ?? ''), [answer?.value]);
  const [days, setDays] = useState<Record<string, ScheduleDay | null>>(() => {
    const next: Record<string, ScheduleDay | null> = {};
    for (const day of WEEK_DAYS) {
      next[day.value] = initial.find((item) => item.day === day.value) ?? null;
    }
    return next;
  });
  const starts = startOptions(weekly);
  const summary = weeklyLabel(weekly);

  function commit(next: Record<string, ScheduleDay | null>) {
    setDays(next);
    const selected = WEEK_DAYS.flatMap((day) => {
      const block = next[day.value];
      return block ? [block] : [];
    });
    if (selected.length === 0) {
      onSave({ value: '' });
      return;
    }
    onSave({ value: JSON.stringify({ days: selected }) });
  }

  return (
    <div className="space-y-2">
      {summary && <p className="text-xs text-neutral-400">{summary} on each day you turn on.</p>}
      {WEEK_DAYS.map((day) => {
        const block = days[day.value];
        const ends = block ? endOptions(block.start, weekly) : [];
        return (
          <div key={day.value} className="rounded-xl border border-white/[0.07] bg-ink-800 p-3">
            <label className="flex items-center gap-3 text-sm text-white">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(block)}
                onChange={(event) => {
                  const next = { ...days };
                  if (!event.target.checked) next[day.value] = null;
                  else {
                    const start = starts[0] ?? '09:00';
                    const end = endOptions(start, weekly)[0] ?? '';
                    next[day.value] = { day: day.value, start, end };
                  }
                  commit(next);
                }}
              />
              {day.label}
            </label>
            {block && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  className={inputClass}
                  aria-label={`${day.label} start`}
                  value={block.start}
                  onChange={(event) => {
                    const start = event.target.value;
                    const endChoices = endOptions(start, weekly);
                    const next = { ...days, [day.value]: { day: day.value, start, end: endChoices[0] ?? '' } };
                    commit(next);
                  }}
                >
                  {starts.map((start) => (
                    <option key={start} value={start}>
                      {clockLabel(start)}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  aria-label={`${day.label} end`}
                  value={block.end}
                  onChange={(event) => {
                    const next = { ...days, [day.value]: { ...block, end: event.target.value } };
                    commit(next);
                  }}
                >
                  {ends.map((end) => (
                    <option key={end} value={end}>
                      {clockLabel(end)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'PHP', 'INR', 'MXN'];

export function PayoutFields({
  step,
  answer,
  onSave,
}: {
  step: OnboardingStep;
  answer: OnboardingAnswer | undefined;
  onSave: (input: Record<string, unknown>) => void;
}) {
  const choices = step.choices?.length
    ? step.choices
    : [
        { value: 'wise', label: 'Wise' },
        { value: 'remitly', label: 'Remitly' },
      ];
  const [editing, setEditing] = useState(!answer?.value);
  useEffect(() => {
    if (answer?.value) {
      setEditing(false);
      setAccountNumber('');
    }
  }, [answer?.value, answer?.last4, answer?.answered_at]);
  const [method, setMethod] = useState(answer?.value || choices[0]?.value || 'wise');
  const [wiseEmail, setWiseEmail] = useState('');
  const [wiseName, setWiseName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [delivery, setDelivery] = useState('bank');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [city, setCity] = useState('');
  const [walletProvider, setWalletProvider] = useState('');
  const [walletPhone, setWalletPhone] = useState('');

  if (!editing && answer?.value) {
    const label = PAYOUT_ONBOARDING_LABELS[answer.value] ?? answer.value;
    return (
      <div className="rounded-xl border border-white/[0.07] bg-ink-800 p-4">
        <p className="text-sm text-white">
          {label} saved{answer.last4 ? `, ending ${answer.last4}` : ''}.
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          This is on your payout record. It is not stored on your Academy profile.
        </p>
        <button
          type="button"
          className="mt-3 text-xs font-semibold text-brand-300 underline"
          onClick={() => setEditing(true)}
        >
          Replace payout details
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          method,
          wise_email: wiseEmail,
          wise_name: wiseName,
          currency,
          legal_name: legalName,
          country,
          phone,
          delivery,
          bank_name: bankName,
          account_number: accountNumber,
          city,
          wallet_provider: walletProvider,
          wallet_phone: walletPhone,
        });
      }}
    >
      <select className={inputClass} aria-label="Preferred payout method" value={method} onChange={(event) => setMethod(event.target.value)}>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
      {method === 'wise' ? (
        <>
          <input className={inputClass} type="email" required placeholder="Email on your Wise account" aria-label="Wise account email" value={wiseEmail} onChange={(event) => setWiseEmail(event.target.value)} />
          <input className={inputClass} required placeholder="Legal name on the Wise account" aria-label="Name on the Wise account" value={wiseName} onChange={(event) => setWiseName(event.target.value)} />
          <select className={inputClass} aria-label="Currency you receive" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <input className={inputClass} required placeholder="Legal name, exactly as it appears on your ID" aria-label="Remitly recipient legal name" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
          <input className={inputClass} required placeholder="Country Remitly should send to" aria-label="Remitly country" value={country} onChange={(event) => setCountry(event.target.value)} />
          <input className={inputClass} required inputMode="tel" placeholder="Mobile number, with country code" aria-label="Remitly mobile number" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <select className={inputClass} aria-label="How Remitly should deliver the money" value={delivery} onChange={(event) => setDelivery(event.target.value)}>
            <option value="bank">Bank deposit</option>
            <option value="cash">Cash pickup</option>
            <option value="wallet">Mobile wallet</option>
          </select>
          {delivery === 'bank' && (
            <>
              <input className={inputClass} required placeholder="Bank name" aria-label="Remitly bank name" value={bankName} onChange={(event) => setBankName(event.target.value)} />
              <input className={inputClass} required inputMode="numeric" autoComplete="off" placeholder="Account number" aria-label="Remitly account number" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
            </>
          )}
          {delivery === 'cash' && (
            <input className={inputClass} required placeholder="City for cash pickup" aria-label="Remitly pickup city" value={city} onChange={(event) => setCity(event.target.value)} />
          )}
          {delivery === 'wallet' && (
            <>
              <input className={inputClass} required placeholder="Wallet provider, such as GCash" aria-label="Mobile wallet provider" value={walletProvider} onChange={(event) => setWalletProvider(event.target.value)} />
              <input className={inputClass} required inputMode="tel" placeholder="Mobile number on that wallet" aria-label="Wallet mobile number" value={walletPhone} onChange={(event) => setWalletPhone(event.target.value)} />
            </>
          )}
        </>
      )}
      <p className="text-xs leading-relaxed text-neutral-500">
        Saved on your payout record, the same place a payout change in the portal goes. Not stored on your Academy profile.
      </p>
      <button type="submit" className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950">
        Save payout details
      </button>
    </form>
  );
}

export function loginSuffix() {
  return `@${DA_LOGIN_DOMAIN}`;
}
