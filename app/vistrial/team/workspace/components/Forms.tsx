'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import { createTeamTaskAction, saveOperatorDomainAction, sendTeamMessageAction, setTeamTargetAction } from '@/lib/sales-workspace/team-actions';
import type { OperatorDetail } from '@/lib/sales-workspace/team-data';

function Note({ text, tone }: { text: string; tone: 'ok' | 'bad' }) {
  return <p className={`mt-2 text-sm ${tone === 'ok' ? 'text-flag-good' : 'text-flag-critical'}`}>{text}</p>;
}

export function DomainForm({
  origin,
  alsoActive,
  retired,
  minutes,
}: {
  origin: string;
  alsoActive: string[];
  retired: string[];
  minutes: number;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="panel space-y-3 rounded-2xl p-4"
      action={(formData) => {
        setMessage(null);
        setError(null);
        start(async () => {
          const result = await saveOperatorDomainAction(formData);
          if (result.ok) setMessage(result.message);
          else setError(result.error);
        });
      }}
    >
      <h2 className="text-sm font-semibold text-white">Operator workspace domain</h2>
      <p className="text-sm text-neutral-400">
        Links, redirects, and emails use this host. A second host can serve during a changeover. A retired host redirects to the current one.
      </p>
      <label className={labelClass}>Current host</label>
      <input name="origin" required defaultValue={origin} className={inputClass} />
      <label className={labelClass}>Also active, one per line</label>
      <textarea name="also_active" rows={2} defaultValue={alsoActive.join('\n')} className={inputClass} />
      <label className={labelClass}>Retired, one per line</label>
      <textarea name="retired" rows={2} defaultValue={retired.join('\n')} className={inputClass} />
      <label className={labelClass}>Refresh Today every (minutes)</label>
      <input name="refresh_minutes" type="number" min={1} max={30} defaultValue={minutes} className={inputClass} />
      {message ? <Note text={message} tone="ok" /> : null}
      {error ? <Note text={error} tone="bad" /> : null}
      <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}

export function TaskForm({ operatorId, placementId }: { operatorId: string; placementId: string | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3 space-y-2"
      action={(formData) => {
        setMessage(null);
        setError(null);
        start(async () => {
          const result = await createTeamTaskAction(operatorId, placementId, formData);
          if (result.ok) setMessage(result.message);
          else setError(result.error);
        });
      }}
    >
      <input name="title" required minLength={3} placeholder="What needs doing" className={inputClass} />
      <input name="detail" placeholder="Detail" className={inputClass} />
      <input name="due_on" type="date" className={inputClass} />
      {message ? <Note text={message} tone="ok" /> : null}
      {error ? <Note text={error} tone="bad" /> : null}
      <button type="submit" disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
        {pending ? 'Saving…' : 'Create task'}
      </button>
    </form>
  );
}

export function MessageForm({ operatorId, placementId }: { operatorId: string; placementId: string | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3 space-y-2"
      action={(formData) => {
        setMessage(null);
        setError(null);
        start(async () => {
          const result = await sendTeamMessageAction(operatorId, placementId, formData);
          if (result.ok) setMessage(result.message);
          else setError(result.error);
        });
      }}
    >
      <textarea name="body" required rows={3} placeholder="Message to this operator" className={inputClass} />
      {message ? <Note text={message} tone="ok" /> : null}
      {error ? <Note text={error} tone="bad" /> : null}
      <button type="submit" disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
        {pending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}

export function TargetForm({ placementId, target }: { placementId: string; target: OperatorDetail['targets'][number] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      action={(formData) => {
        setMessage(null);
        setError(null);
        start(async () => {
          const result = await setTeamTargetAction(placementId, target.metric_key, formData);
          if (result.ok) setMessage(result.message);
          else setError(result.error);
        });
      }}
    >
      <label className="text-xs text-neutral-500">
        Daily
        <input name="daily" type="number" min={0} step="0.1" defaultValue={target.daily ?? ''} className={`${inputClass} mt-1 w-24`} />
      </label>
      <label className="text-xs text-neutral-500">
        Weekly
        <input name="weekly" type="number" min={0} step="0.1" defaultValue={target.weekly ?? ''} className={`${inputClass} mt-1 w-24`} />
      </label>
      <button type="submit" disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      {message ? <Note text={message} tone="ok" /> : null}
      {error ? <Note text={error} tone="bad" /> : null}
    </form>
  );
}
