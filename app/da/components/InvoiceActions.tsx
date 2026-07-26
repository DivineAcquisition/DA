'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, inputClass, labelClass } from '@/app/vistrial/components/ui';
import {
  creditNoteAction,
  issueInvoiceAction,
  recordPaymentAction,
  writeOffAction,
} from '@/lib/da/billingActions';

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function InvoiceActions({
  invoiceId,
  status,
  lines,
}: {
  invoiceId: string;
  status: string;
  lines: { id: string; description: string; amount: number }[];
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showLines, setShowLines] = useState(false);
  const [mode, setMode] = useState<'none' | 'credit' | 'writeoff'>('none');
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean } & ({ message: string } | { error: string })>) =>
    startTransition(async () => {
      const result = await fn();
      setMessage({ ok: result.ok, text: 'message' in result ? result.message : result.error });
      if (result.ok) setMode('none');
    });

  return (
    <div className="mt-3.5 border-t border-white/[0.06] pt-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {lines.length > 0 && (
          <button
            type="button"
            onClick={() => setShowLines((value) => !value)}
            className="text-xs font-semibold text-brand-300 transition-colors hover:text-brand-200"
          >
            {showLines ? 'Hide lines' : `${lines.length} lines`}
          </button>
        )}

        {status === 'draft' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => issueInvoiceAction(invoiceId))}
            className={`${btnPrimary} ${btnSizeSm}`}
          >
            Issue
          </button>
        )}

        {['issued', 'overdue', 'failed'].includes(status) && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => recordPaymentAction(invoiceId, 'succeeded'))}
              className={`${btnPrimary} ${btnSizeSm}`}
            >
              Mark paid
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => recordPaymentAction(invoiceId, 'failed', 'Recorded manually from the processor.'))
              }
              className={`${btnSecondary} ${btnSizeSm}`}
            >
              Record failure
            </button>
          </>
        )}

        {status !== 'draft' && (
          <>
            <button type="button" onClick={() => setMode('credit')} className={`${btnSecondary} ${btnSizeSm}`}>
              Credit note
            </button>
            {status !== 'paid' && status !== 'written_off' && (
              <button type="button" onClick={() => setMode('writeoff')} className={`${btnSecondary} ${btnSizeSm}`}>
                Write off
              </button>
            )}
          </>
        )}
      </div>

      {status !== 'draft' && (
        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
          <Badge tone="neutral">Immutable</Badge>
          An issued invoice cannot be edited. Corrections are credit notes.
        </p>
      )}

      {showLines && (
        <ul className="mt-3 divide-y divide-white/[0.05] rounded-xl bg-white/[0.02] px-3.5">
          {lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-4 py-2.5 text-xs">
              <span className="min-w-0 text-neutral-300">{line.description}</span>
              <span className="shrink-0 tabular-nums text-white">{money(line.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {mode === 'credit' && (
        <form
          className="mt-3 space-y-3"
          action={(formData) => run(() => creditNoteAction(invoiceId, formData))}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor={`amt-${invoiceId}`}>
                Amount
              </label>
              <input id={`amt-${invoiceId}`} name="amount" type="number" step="0.01" required className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor={`rsn-${invoiceId}`}>
                Reason
              </label>
              <input id={`rsn-${invoiceId}`} name="reason" required className={inputClass} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
              Issue credit note
            </button>
            <button type="button" onClick={() => setMode('none')} className={`${btnSecondary} ${btnSizeSm}`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === 'writeoff' && (
        <form
          className="mt-3 space-y-3"
          action={(formData) => run(() => writeOffAction(invoiceId, String(formData.get('reason') ?? '')))}
        >
          <div>
            <label className={labelClass} htmlFor={`wo-${invoiceId}`}>
              Why write it off
            </label>
            <input id={`wo-${invoiceId}`} name="reason" required className={inputClass} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
              Write off
            </button>
            <button type="button" onClick={() => setMode('none')} className={`${btnSecondary} ${btnSizeSm}`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {message && (
        <p
          className={`mt-3 rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed ${
            message.ok
              ? 'border-flag-good/25 bg-flag-good/[0.08] text-flag-good'
              : 'border-flag-critical/25 bg-flag-critical/[0.08] text-flag-critical'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
