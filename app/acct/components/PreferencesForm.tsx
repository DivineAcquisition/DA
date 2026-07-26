'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import { Panel } from '@/app/vistrial/components/ui';
import { updatePreferencesAction } from '@/lib/acct/actions';

const OPTIONS = [
  { name: 'weekly_digest', label: 'Weekly summary', detail: 'Your numbers for the week, every Monday.' },
  { name: 'milestone_alerts', label: 'Milestones', detail: 'When something notable happens on your account.' },
  { name: 'report_published', label: 'New reports', detail: 'When DA publishes a growth report to you.' },
] as const;

export default function PreferencesForm({
  initial,
}: {
  initial: Record<(typeof OPTIONS)[number]['name'], boolean>;
}) {
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Panel className="p-5">
      <form
        action={(formData) => {
          setResult(null);
          startTransition(async () => {
            const outcome = await updatePreferencesAction(formData);
            setResult(outcome.ok ? outcome.message : outcome.error);
          });
        }}
        className="space-y-3"
      >
        {OPTIONS.map((option) => (
          <label
            key={option.name}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] px-3.5 py-3 hover:bg-white/[0.03]"
          >
            <input
              type="checkbox"
              name={option.name}
              defaultChecked={initial[option.name]}
              className="mt-0.5 h-4 w-4 accent-[#9a88fc]"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-white">{option.label}</span>
              <span className="block text-xs text-neutral-500">{option.detail}</span>
            </span>
          </label>
        ))}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
            {pending ? 'Saving…' : 'Save preferences'}
          </button>
          {result && <span className="text-xs text-neutral-500">{result}</span>}
        </div>
      </form>
    </Panel>
  );
}
