'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { formatDate } from '@/lib/portal/time';
import { decideDisputeAction, decideTierAction, resolveBlockerAction } from '@/lib/team/actions';
import type { Queues } from '@/lib/team/types';
import { inputClass } from '../components/ui';
import { CONTROL_LABEL } from '@/lib/portal/standards';
import { Feedback, useAction } from '../operator/components/portal';

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="panel rounded-2xl p-4">
      <h2 className="mb-3 text-sm font-semibold text-white">
        {title} <span className="text-neutral-500">({count})</span>
      </h2>
      {count === 0 ? <p className="text-sm text-neutral-500">Nothing waiting.</p> : children}
    </section>
  );
}

/** Everything waiting on a person. The system flags; staff decide, with a reason. */
export default function QueuesView({ queues }: { queues: Queues }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Queues</h1>

      <Section title="Disputes to decide" count={queues.disputes.length}>
        <ul className="space-y-3">
          {queues.disputes.map((d) => (
            <Decide key={d.id} title={`${d.operator_name} · ${d.standard}`} detail={`${d.item_label}. They said: ${d.explanation}`}>
              {(reason, run) => (
                <>
                  <button type="button" onClick={() => run(() => decideDisputeAction(d.id, true, reason))} className={`${btnPrimary} ${btnSizeSm}`}>
                    Approve
                  </button>
                  <button type="button" onClick={() => run(() => decideDisputeAction(d.id, false, reason))} className={`${btnSecondary} ${btnSizeSm}`}>
                    Decline
                  </button>
                </>
              )}
            </Decide>
          ))}
        </ul>
      </Section>

      <Section title="Client-side and DA-side blockers" count={queues.blockers.length}>
        <ul className="space-y-3">
          {queues.blockers.map((b) => (
            <Decide
              key={b.id}
              title={`${CONTROL_LABEL[b.control]} · ${b.operator_name} · ${b.client_name}`}
              detail={`${formatDate(b.shift_date)}: ${b.note}`}
              placeholder="What was done about it"
            >
              {(reason, run) => (
                <button type="button" onClick={() => run(() => resolveBlockerAction(b.id, reason))} className={`${btnPrimary} ${btnSizeSm}`}>
                  Mark resolved
                </button>
              )}
            </Decide>
          ))}
        </ul>
      </Section>

      <Section title={`Feedback owed for the week of ${formatDate(queues.last_week)}`} count={queues.feedback_owed.length}>
        <ul className="space-y-2">
          {queues.feedback_owed.map((f) => (
            <li key={f.operator_id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block text-neutral-200">{f.operator_name}</span>
                <span className="block truncate text-xs text-neutral-500">
                  {f.self_review ? `Their focus: ${f.self_review}` : 'No self-review yet'}
                </span>
              </span>
              <Link href={`/vistrial/team/operator/${f.operator_id}#feedback`} className={`${btnSecondary} ${btnSizeSm}`}>
                Write feedback
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Suspected missed shifts" count={queues.suspected_missed.length}>
        <ul className="space-y-2">
          {queues.suspected_missed.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
              <span className="text-neutral-200">
                {s.operator_name} · {s.client_name} · {formatDate(s.shift_date)}
              </span>
              <Link href="/vistrial/team" className="text-xs text-brand-200 underline">
                Decide in the admin panel
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Unclear attribution" count={queues.attribution.length}>
        <p className="mb-2 text-xs text-neutral-500">
          Untagged leads or touches that arrived while two placements on the same client were on shift. They are left out of both
          VAs&apos; numbers, never guessed.
        </p>
        <ul className="space-y-2">
          {queues.attribution.map((a) => (
            <li key={`${a.placement_id}-${a.shift_date}`} className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm text-neutral-200">
              {a.operator_name} · {a.client_name} · {formatDate(a.shift_date)} · {a.ambiguous} records
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Tier eligibility to decide" count={queues.tier_eligible.length}>
        <ul className="space-y-3">
          {queues.tier_eligible.map((t) => (
            <Decide
              key={t.operator_id}
              title={`${t.operator_name}: Tier ${t.tier ?? 1} to Tier ${t.to_tier}`}
              detail={`Meets every criterion since ${formatDate(t.eligible_at.slice(0, 10))}. The tier does not change until you decide.`}
              placeholder="Your reason (the VA sees it)"
            >
              {(reason, run) => (
                <>
                  <button
                    type="button"
                    onClick={() => run(() => decideTierAction({ operatorId: t.operator_id, toTier: t.to_tier, approve: true, reason }))}
                    className={`${btnPrimary} ${btnSizeSm}`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => decideTierAction({ operatorId: t.operator_id, toTier: t.to_tier, approve: false, reason }))}
                    className={`${btnSecondary} ${btnSizeSm}`}
                  >
                    Decline
                  </button>
                </>
              )}
            </Decide>
          ))}
        </ul>
      </Section>

      <Section title="Formal notices awaiting review" count={queues.formal_drafts.length}>
        <ul className="space-y-2">
          {queues.formal_drafts.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
              <span className="text-neutral-200">
                {f.operator_name}: {f.subject}
              </span>
              <Link href={`/vistrial/team/operator/${f.operator_id}#notices`} className={`${btnSecondary} ${btnSizeSm}`}>
                Review
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Decide({
  title,
  detail,
  placeholder = 'Your reason (the VA sees it)',
  children,
}: {
  title: string;
  detail: string;
  placeholder?: string;
  children: (reason: string, run: (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => void) => React.ReactNode;
}) {
  const [reason, setReason] = useState('');
  const action = useAction();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    if (reason.trim().length < 3) {
      action.setError('Add a reason first.');
      return;
    }
    action.run(fn as never);
  };
  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-xs text-neutral-400">{detail}</p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} mt-2`} placeholder={placeholder} />
      <div className="mt-2 flex flex-wrap gap-2">{children(reason, run)}</div>
      <Feedback message={action.message} error={action.error} />
    </li>
  );
}
