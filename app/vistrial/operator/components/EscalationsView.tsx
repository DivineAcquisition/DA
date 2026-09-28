'use client';

import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { closeEscalationAction, markEscalationReadAction, raiseEscalationAction } from '@/lib/portal/actions';
import { ESCALATION_CATEGORY, escalationCategory, escalationStatus } from '@/lib/portal/labels';
import { formatDateTime } from '@/lib/portal/time';
import type { EscalationRow, EscalationsData } from '@/lib/portal/types';
import { Badge, inputClass, labelClass } from '../../components/ui';
import { Card, Empty, Feedback, Sheet, useAction, usePortal, VaButton, VaFieldset } from './portal';

/** "Escalate, don't guess" (Section 5.6): raise it, hold the customer, act on the answer. */
export default function EscalationsView({ data, startOpen }: { data: EscalationsData; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen && data.live);
  const [holding, setHolding] = useState<{ line: string; due: string } | null>(null);
  const { operatorZone } = usePortal();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Escalations</h1>
        {data.live ? (
          <VaButton type="button" onClick={() => setOpen(true)} className={`${btnPrimary} ${btnSizeSm}`}>
            I need help
          </VaButton>
        ) : null}
      </div>

      {holding ? (
        <Card className="border border-brand-500/40">
          <p className="text-sm font-semibold">Sent. Use this with the customer while you wait:</p>
          <p className="mt-2 rounded-xl bg-brand-500/[0.1] px-3 py-2.5 text-base text-brand-100">“{holding.line}”</p>
          <p className="mt-2 text-xs text-neutral-400">DA answers by {formatDateTime(holding.due, operatorZone)}.</p>
        </Card>
      ) : null}

      {data.escalations.length === 0 ? <Empty>No escalations yet.</Empty> : null}
      <ul className="space-y-3">
        {data.escalations.map((item) => (
          <EscalationCard key={item.id} item={item} />
        ))}
      </ul>

      <Sheet open={open} onClose={() => setOpen(false)} title="I need help">
        <RaiseForm
          data={data}
          onSent={(line, due) => {
            setHolding({ line, due });
            setOpen(false);
          }}
        />
      </Sheet>
    </div>
  );
}

function EscalationCard({ item }: { item: EscalationRow }) {
  const { operatorZone, readOnly } = usePortal();
  const action = useAction();
  const status = escalationStatus(item.status);
  const [expanded, setExpanded] = useState(item.answer_ready);

  return (
    <li id={item.id}>
      <Card className={item.answer_ready ? 'border border-flag-good/40' : item.overdue ? 'border border-flag-critical/40' : ''}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{escalationCategory(item.category)}</p>
            <p className="text-xs text-neutral-500">
              Raised {formatDateTime(item.raised_at, operatorZone)}
              {item.response_due_at && item.status === 'open' ? ` · answer due ${formatDateTime(item.response_due_at, operatorZone)}` : ''}
            </p>
          </div>
          {item.answer_ready ? <Badge tone="good">Answer ready</Badge> : <Badge tone={status.tone}>{status.label}</Badge>}
        </div>

        {item.overdue ? (
          <p className="mt-2 rounded-xl bg-flag-critical/[0.08] px-3 py-2 text-sm text-flag-critical">
            DA is late responding, keep the customer warm. This is on DA, not you.
          </p>
        ) : null}

        {item.customer_context === null ? (
          <p className="mt-2 text-xs text-neutral-500">Details are hidden now that this placement has ended.</p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setExpanded(!expanded);
              if (item.answer_ready && !readOnly) void markEscalationReadAction(item.id);
            }}
            className="mt-2 text-xs text-neutral-400 underline"
          >
            {expanded ? 'Hide details' : item.answer_ready ? 'Read the answer' : 'Show details'}
          </button>
        )}

        {expanded && item.customer_context !== null ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-neutral-400">
              <span className="text-neutral-500">What was happening: </span>
              {item.customer_context}
            </p>
            <p className="text-neutral-300">
              <span className="text-neutral-500">What you needed: </span>
              {item.needed}
            </p>
            {item.answer ? (
              <div className="rounded-xl bg-flag-good/[0.08] px-3 py-2.5">
                <p className="text-[11px] text-neutral-400">
                  Answer from {item.answered_by ?? 'DA'}
                  {item.answered_at ? `, ${formatDateTime(item.answered_at, operatorZone)}` : ''}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-neutral-100">{item.answer}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {item.status !== 'closed' && item.customer_context !== null ? (
          <div className="mt-3">
            <VaButton
              type="button"
              disabled={action.pending}
              onClick={() => action.run(() => closeEscalationAction(item.id))}
              className={`${btnSecondary} px-3 py-1.5 text-xs`}
            >
              {item.status === 'answered' ? 'Done, close it' : 'Resolved, close it'}
            </VaButton>
          </div>
        ) : null}
        <Feedback error={action.error} />
      </Card>
    </li>
  );
}

function RaiseForm({ data, onSent }: { data: EscalationsData; onSent: (line: string, due: string) => void }) {
  const action = useAction();
  const [category, setCategory] = useState('');
  const [context, setContext] = useState('');
  const [needed, setNeeded] = useState('');
  const { placementId } = usePortal();

  return (
    <VaFieldset>
      <p className="text-sm text-neutral-400">
        DA answers within {data.escalation_response_hours ?? 4} hours. You get a line to hold the customer with.
      </p>
      <fieldset className="mt-4 space-y-2">
        <legend className={labelClass}>What kind of question</legend>
        {Object.entries(ESCALATION_CATEGORY).map(([value, item]) => (
          <label
            key={value}
            className={`block cursor-pointer rounded-xl border px-3 py-2 ${category === value ? 'border-brand-500/60 bg-brand-500/[0.08]' : 'border-white/[0.08]'}`}
          >
            <span className="flex items-center gap-2">
              <input type="radio" name="category" value={value} checked={category === value} onChange={() => setCategory(value)} />
              <span className="text-sm font-medium text-white">{item.label}</span>
            </span>
            <span className="mt-0.5 block pl-6 text-xs text-neutral-400">{item.detail}</span>
          </label>
        ))}
      </fieldset>
      <label className={`${labelClass} mt-4`}>What&apos;s happening</label>
      <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={3} className={inputClass} placeholder="In the customer's words" />
      <label className={`${labelClass} mt-3`}>What you need</label>
      <textarea value={needed} onChange={(e) => setNeeded(e.target.value)} rows={2} className={inputClass} placeholder="The exact question or decision" />
      <button
        type="button"
        disabled={action.pending || !category || context.trim().length < 5 || needed.trim().length < 5}
        onClick={() =>
          action.run(
            () => raiseEscalationAction({ placementId: placementId ?? data.placement_id, category, context, needed }),
            (result) => {
              if (result.ok && result.data) onSent(result.data.holding_line, result.data.response_due_at);
            },
          )
        }
        className={`${btnPrimary} ${btnSizeSm} mt-4`}
      >
        Send to DA
      </button>
      <Feedback error={action.error} />
    </VaFieldset>
  );
}
