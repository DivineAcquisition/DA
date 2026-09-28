'use client';

import { useEffect, useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { REASON_KINDS, reasonKind } from '@/lib/portal/labels';
import { startViewAsAction, viewAsSessionsAction } from '@/lib/portal/staffActions';
import { inputClass, labelClass, selectClass } from './ui';

export type SessionRow = {
  id: string;
  kind: string;
  actor_profile_id: string;
  actor_name: string;
  actor_role: string;
  target_name: string;
  operator_id: string | null;
  reason_kind: string | null;
  reason: string;
  started_at: string;
  ended_at: string | null;
  ended_reason: string | null;
  live: boolean;
  extended_at: string | null;
  extension_reason: string | null;
  minutes: number;
  pages: string[];
  actions: { at: string; action: string; summary: string }[];
};

const ENDED: Record<string, string> = {
  exited: 'Exited',
  expired: 'Expired',
  lockdown: 'Ended by lockdown',
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/**
 * "View as [Name]": a reason, a note the operator will read, and a fresh
 * password confirmation. The database decides whether this viewer may open this
 * operator, starts a 30-minute read-only session and tells the operator.
 */
export function ViewAsButton({ operatorId, name, hasAccount }: { operatorId: string; name: string; hasAccount: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!hasAccount) {
    return <span className="text-xs text-neutral-500">No sign-in yet, so there is nothing to view.</span>;
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${btnSecondary} ${btnSizeSm} border-cyan-400/40 text-cyan-200`}>
        View as {name}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`View as ${name}`}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <form
            className="relative w-full rounded-t-3xl border border-cyan-400/30 bg-ink-900 p-5 sm:max-w-md sm:rounded-3xl"
            action={(formData) => {
              setError(null);
              startTransition(async () => {
                const result = await startViewAsAction(operatorId, formData);
                if (result && !result.ok) setError(result.error);
              });
            }}
          >
            <h2 className="text-base font-semibold text-white">View as {name}</h2>
            <p className="mt-1 text-sm text-neutral-400">
              You see their portal exactly as they do, read-only, for 30 minutes. They are told who viewed it and why.
              Every page you open is recorded.
            </p>
            <label className={`${labelClass} mt-4`}>Reason</label>
            <select name="reason_kind" required defaultValue="" className={selectClass}>
              <option value="" disabled>
                Choose a reason
              </option>
              {REASON_KINDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <label className={`${labelClass} mt-3`}>Note (they will read it)</label>
            <textarea name="note" required minLength={5} rows={2} className={inputClass} placeholder="Checking why last week's bookings were rejected" />
            <label className={`${labelClass} mt-3`}>Your password</label>
            <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
            {error ? <p className="mt-3 text-sm text-flag-critical">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
                {pending ? 'Starting…' : 'Start viewing'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className={`${btnSecondary} ${btnSizeSm}`}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function SessionList({ rows, showTarget }: { rows: SessionRow[]; showTarget: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-neutral-500">No sessions yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-white">
              {row.actor_name} <span className="text-xs font-normal text-neutral-500">({row.actor_role})</span>
              {showTarget ? <span className="font-normal text-neutral-400"> viewed {row.target_name}</span> : null}
            </span>
            <span className={`text-xs ${row.live ? 'text-cyan-300' : 'text-neutral-500'}`}>
              {row.live ? 'Live now' : ENDED[row.ended_reason ?? ''] ?? 'Ended'}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {fmt(row.started_at)} · {row.minutes} min · {row.kind === 'view_as' ? reasonKind(row.reason_kind) : 'Impersonation'}
          </p>
          <p className="mt-1 text-xs text-neutral-300">{row.reason}</p>
          {row.extension_reason ? <p className="mt-1 text-xs text-neutral-500">Extended: {row.extension_reason}</p> : null}
          {row.pages.length ? <p className="mt-1 text-xs text-neutral-500">Viewed: {row.pages.join(', ')}</p> : null}
          {row.actions.length ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-neutral-500">{row.actions.length} recorded actions</summary>
              <ul className="mt-1 space-y-0.5 text-xs text-neutral-400">
                {row.actions.map((a, i) => (
                  <li key={i}>
                    {fmt(a.at)} · {a.summary}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Every View As session on one operator: who, when, how long, why, what they opened. */
export function OperatorSessions({ operatorId }: { operatorId: string }) {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const result = await viewAsSessionsAction({ operatorId });
      if (result.ok) setRows((result.data ?? []) as SessionRow[]);
      else setError(result.error);
    })();
  }, [operatorId]);
  if (error) return <p className="text-sm text-flag-critical">{error}</p>;
  if (!rows) return <p className="text-sm text-neutral-500">Loading…</p>;
  return <SessionList rows={rows} showTarget={false} />;
}
