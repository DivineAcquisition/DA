'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Field, Input, Textarea } from '../../components/ui';
import {
  confirmLaunchAction,
  reviewLaunchAction,
  runHealthCheckAction,
  saveLaunchSettingsAction,
  waiveLaunchAction,
} from '@/lib/placement/actions';
import type { CheckItem } from '@/lib/placement/types';

type Health = { key: string; area: string; result: string; reason: string; admin_only?: boolean };

export function LaunchChecklist({
  placementId,
  items,
  isAdmin,
}: {
  placementId: string;
  items: CheckItem[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  return (
    <ul className="space-y-3 text-sm">
      {error ? <li className="text-amber-200">{error}</li> : null}
      {items.map((item) => (
        <li key={item.key} className="rounded-xl border border-white/10 px-3 py-3">
          <p className={item.overdue ? 'text-red-300' : 'text-white'}>
            {item.overdue ? 'Overdue' : item.blocking ? 'Still needed' : item.waived ? 'Waived' : item.met ? 'Met' : 'Open'} — {item.label}
          </p>
          {item.fix && !item.met && !item.waived ? <p className="mt-1 text-neutral-300">{item.fix}</p> : null}
          {item.waiver_reason ? <p className="mt-1 text-neutral-400">Waived: {item.waiver_reason}</p> : null}
          {item.checked_by ? <p className="mt-1 text-neutral-400">Confirmed by {item.checked_by}.</p> : null}
          {item.met && item.automatic ? <p className="mt-1 text-neutral-500">Checked by the system.</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {item.href ? (
              <Link href={item.href} className="underline text-neutral-300">
                Open the screen
              </Link>
            ) : null}
            {!item.automatic && !item.met ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await confirmLaunchAction(placementId, item.key);
                    setError(result.ok ? null : result.error);
                    if (result.ok) router.refresh();
                  })
                }
              >
                Confirm
              </Button>
            ) : null}
          </div>
          {isAdmin && (item.blocking || item.overdue || item.open) && !item.waived ? (
            <div className="mt-2 flex gap-2">
              <Input value={reasons[item.key] ?? ''} placeholder="Reason for the waiver" onChange={(event) => setReasons({ ...reasons, [item.key]: event.target.value })} />
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await waiveLaunchAction(placementId, item.key, reasons[item.key] ?? '');
                    setError(result.ok ? null : result.error);
                    if (result.ok) router.refresh();
                  })
                }
              >
                Waive
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function HealthCheck({
  placementId,
  isAdmin,
  latest,
}: {
  placementId: string;
  isAdmin: boolean;
  latest: { overall: string; ran_at: string; results: Health[] } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rows = (latest?.results ?? []).filter((row) => isAdmin || !row.admin_only);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await runHealthCheckAction(placementId);
              setError(result.ok ? null : result.error);
              if (result.ok) router.refresh();
            })
          }
        >
          Run health check
        </Button>
        {latest ? <p className="text-neutral-300">Last result: {latest.overall}. {latest.ran_at}</p> : <p className="text-neutral-400">No health check yet.</p>}
      </div>
      {error ? <p className="text-amber-200">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.key}>
            <span className={row.result === 'fail' ? 'text-red-300' : row.result === 'warn' ? 'text-amber-200' : 'text-emerald-200'}>{row.result}</span>
            <span className="text-neutral-400"> · {row.area} · </span>
            <span className="text-white">{row.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LaunchSettingsForm({
  placementId,
  enabled,
  days,
  combine,
}: {
  placementId: string;
  enabled: boolean;
  days: number;
  combine: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await saveLaunchSettingsAction(placementId, {
            summary_enabled: data.get('summary_enabled') === 'on',
            summary_days: Number(data.get('summary_days')),
            combine_short_week: data.get('combine_short_week') === 'on',
          });
          setError(result.ok ? null : result.error);
          if (result.ok) router.refresh();
        });
      }}
    >
      <label className="flex items-center gap-2">
        <input type="checkbox" name="summary_enabled" defaultChecked={enabled} /> Launch day summaries
      </label>
      <Field label="Summary days">
        <select name="summary_days" defaultValue={String(days)} className="h-9 rounded-lg border border-white/10 bg-transparent px-3">
          <option value="5">5 working days</option>
          <option value="10">10 working days</option>
        </select>
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="combine_short_week" defaultChecked={combine} /> Combine a short first week with the next week
      </label>
      {error ? <p className="text-amber-200">{error}</p> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        Save launch settings
      </Button>
    </form>
  );
}

export function ReviewForm({ placementId }: { placementId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await reviewLaunchAction(placementId, String(data.get('decision') ?? ''), String(data.get('note') ?? ''));
          setError(result.ok ? null : result.error);
          if (result.ok) router.refresh();
        });
      }}
    >
      <Field label="Decision">
        <select name="decision" className="h-9 w-full rounded-lg border border-white/10 bg-transparent px-3" defaultValue="keep">
          <option value="keep">Keep</option>
          <option value="adjust">Adjust</option>
          <option value="coach">Coach</option>
          <option value="escalate">Escalate to DA Admin</option>
        </select>
      </Field>
      <Field label="Note">
        <Textarea name="note" required minLength={8} rows={3} />
      </Field>
      {error ? <p className="text-amber-200">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        Save review
      </Button>
      <p className="text-neutral-400">This stays with the manager and DA Admin. It does not email the operator or the client.</p>
    </form>
  );
}
