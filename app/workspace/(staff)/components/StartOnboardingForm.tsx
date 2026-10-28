'use client';

import { useState, useTransition } from 'react';
import { startSalesOperatorOnboardingAction } from '@/lib/workspace/onboarding-actions';
import { Button, Field, Select } from './ui';

type Operator = { id: string; full_name: string; email: string };

export function StartOnboardingForm({
  operators,
  presetRecipientId,
}: {
  operators: Operator[];
  presetRecipientId?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        setError(null);
        setMessage(null);
        setUrl(null);
        startTransition(async () => {
          const result = await startSalesOperatorOnboardingAction(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setMessage(result.message);
          const next = result.data?.url;
          setUrl(typeof next === 'string' ? next : null);
        });
      }}
    >
      <Field label="Sales operator">
        <Select name="recipient_id" defaultValue={presetRecipientId ?? ''} required>
          <option value="" disabled>
            Choose an operator
          </option>
          {operators.map((operator) => (
            <option key={operator.id} value={operator.id}>
              {operator.full_name} · {operator.email}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex items-start gap-2 text-sm text-neutral-300">
        <input name="send_email" type="checkbox" className="mt-1 accent-[#9a88fc]" />
        <span>Email them the link</span>
      </label>
      <Button type="submit" disabled={pending || operators.length === 0}>
        {pending ? 'Starting…' : 'Start onboarding'}
      </Button>
      {message && <p className="text-sm text-neutral-200">{message}</p>}
      {error && <p className="text-sm text-[var(--ws-error)]">{error}</p>}
      {url && (
        <p className="break-all text-sm">
          <a className="text-[var(--ws-accent)] underline" href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </p>
      )}
    </form>
  );
}
