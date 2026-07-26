'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge } from '@/app/vistrial/components/ui';
import type { ActionResult } from '@/lib/da/documentActions';

type Flag = {
  id: string;
  section_key: string;
  kind: string;
  snippet: string;
  suggestion: string | null;
  confirmed_at: string | null;
};

const KIND_LABEL: Record<string, string> = {
  client_name: 'Business name',
  person: 'Person',
  location: 'Location',
  brand: 'Web or brand',
  other: 'Possible identifier',
};

/**
 * Rule 9. Anonymisation is assisted, not automatic: the scanner deliberately
 * over-flags and every flag needs a human decision, either a rewrite or an
 * explicit "this is not identifying". The draft is not usable until the list is
 * empty, because an automatic pass that misses one reference creates false
 * confidence.
 */
export default function AnonymisationPanel({
  flags,
  editable,
  resolve,
}: {
  flags: Flag[];
  editable: boolean;
  resolve: (flagId: string, formData: FormData) => Promise<ActionResult | void>;
}) {
  const open = flags.filter((flag) => !flag.confirmed_at);
  const done = flags.filter((flag) => flag.confirmed_at);

  return (
    <div className="space-y-4">
      {open.length === 0 ? (
        <p className="text-sm leading-relaxed text-flag-good">
          Every flagged reference has a decision on it. The draft is usable as a sales asset.
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-neutral-400">
          {open.length} reference{open.length === 1 ? '' : 's'} the scanner believes could identify this client.
          Rewrite the ones that would, and confirm the ones that would not.
        </p>
      )}

      <ul className="space-y-2.5">
        {open.map((flag) => (
          <li key={flag.id}>
            <FlagRow flag={flag} editable={editable} resolve={resolve} />
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
            {done.length} already decided
          </summary>
          <ul className="mt-3 space-y-1.5">
            {done.map((flag) => (
              <li key={flag.id} className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <Badge tone="good">Decided</Badge>
                <span className="font-mono text-neutral-400">{flag.snippet}</span>
                <span>in {flag.section_key}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function FlagRow({
  flag,
  editable,
  resolve,
}: {
  flag: Flag;
  editable: boolean;
  resolve: (flagId: string, formData: FormData) => Promise<ActionResult | void>;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [replacement, setReplacement] = useState(flag.suggestion ?? '');

  const submit = (formData: FormData) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await resolve(flag.id, formData);
      if (outcome) setResult(outcome);
    });
  };

  return (
    <form className="rounded-xl border border-white/[0.1] bg-white/[0.02] p-4" action={submit}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={flag.kind === 'other' ? 'neutral' : 'warning'}>{KIND_LABEL[flag.kind] ?? flag.kind}</Badge>
        <span className="font-mono text-sm text-white">{flag.snippet}</span>
        <span className="text-xs text-neutral-500">in the {flag.section_key} section</span>
      </div>

      {editable && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              name="replacement"
              value={replacement}
              onChange={(event) => setReplacement(event.target.value)}
              placeholder="Replace with, or leave blank to keep it"
              className="min-w-56 flex-1 rounded-full border border-white/[0.12] bg-white/[0.03] px-4 py-2 text-[13px] text-white placeholder:text-neutral-600 focus:border-brand-500/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending}
              className={`${replacement.trim() ? btnPrimary : btnSecondary} ${btnSizeSm}`}
            >
              {pending ? 'Working…' : replacement.trim() ? 'Rewrite' : 'Not identifying'}
            </button>
          </div>
          {result && !result.ok && <p className="mt-2 text-xs text-flag-critical">{result.error}</p>}
        </>
      )}
    </form>
  );
}
