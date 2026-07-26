'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import { Badge } from '@/app/vistrial/components/ui';
import type { ActionResult } from '@/lib/da/documentActions';

/**
 * The admin's writing surface for one narrative section.
 *
 * Only narrative sections get an editor at all: a bound section has no text field
 * anywhere in this application, which is how "bound numbers are never manually
 * typed" holds without relying on anyone remembering it. The database refuses the
 * write too, and the message it raises is what appears below.
 */
export default function NarrativeEditor({
  sectionKey,
  title,
  prompt,
  body,
  required,
  action,
}: {
  sectionKey: string;
  title: string;
  prompt: string | null;
  body: string | null;
  required: boolean;
  action: (formData: FormData) => Promise<ActionResult | void>;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(body ?? '');

  // Rule 10 is a database constraint, but flagging it as the admin types is
  // kinder than rejecting the save.
  const hasEmDash = value.includes('\u2014');
  const dirty = value !== (body ?? '');

  return (
    <form
      id={sectionKey}
      className="space-y-3"
      action={(formData) => {
        setResult(null);
        startTransition(async () => {
          const outcome = await action(formData);
          if (outcome) setResult(outcome);
        });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{title}</h3>
        {!body && required && <Badge tone="warning">Needs writing</Badge>}
        {body && <Badge tone="good">Written</Badge>}
      </div>

      {prompt && <p className="text-xs leading-relaxed text-neutral-500">{prompt}</p>}

      <textarea
        name="body"
        rows={5}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Outcome first, mechanism second. Plain and direct, no hype."
        className="w-full rounded-xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-600 focus:border-brand-500/50 focus:outline-none"
      />

      {hasEmDash && (
        <p className="text-xs leading-relaxed text-flag-warning">
          There is an em dash in this text. DA prose uses commas, colons, parentheses or full stops instead, and the
          database will refuse the save.
        </p>
      )}

      {result && (
        <p
          className={`text-xs leading-relaxed ${
            result.ok ? 'text-flag-good' : 'text-flag-critical'
          }`}
        >
          {result.ok ? result.message : result.error}
        </p>
      )}

      <button type="submit" disabled={pending || !dirty} className={`${btnPrimary} ${btnSizeSm}`}>
        {pending ? 'Saving…' : dirty ? 'Save section' : 'Saved'}
      </button>
    </form>
  );
}
