'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, inputClass, labelClass, selectClass, type Tone } from '@/app/vistrial/components/ui';
import { confirmPayoutAction, failPayoutAction } from '@/lib/da/billingActions';

const money = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const TONE: Record<string, Tone> = {
  pending: 'neutral',
  sent: 'warning',
  confirmed: 'good',
  failed: 'critical',
  returned: 'critical',
};

type PayoutView = {
  id: string;
  amount: number;
  base: number;
  commission: number;
  bonus: number;
  adjustments: number;
  status: string;
  method: string | null;
  reference: string | null;
  sentReference: string | null;
  confirmedAt: string | null;
  failureReason: string | null;
  rolledFrom: boolean;
  locked: boolean;
  statementId: string | null;
};

export default function PayoutRow({
  payout,
  operatorName,
  batchApproved,
}: {
  payout: PayoutView;
  operatorName: string;
  batchApproved: boolean;
}) {
  const [mode, setMode] = useState<'none' | 'confirm' | 'fail'>('none');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean } & ({ message: string } | { error: string })>) =>
    startTransition(async () => {
      const result = await fn();
      setMessage({ ok: result.ok, text: 'message' in result ? result.message : result.error });
      if (result.ok) setMode('none');
    });

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-white">{operatorName}</p>
            <Badge tone={TONE[payout.status] ?? 'neutral'}>{payout.status}</Badge>
            {payout.locked && <Badge tone="neutral">locked</Badge>}
            {payout.rolledFrom && <Badge tone="warning">rolled forward</Badge>}
          </div>
          <p className="mt-1 text-[11px] text-neutral-600">
            {money(payout.base)} base
            {payout.commission > 0 && ` · ${money(payout.commission)} commission`}
            {payout.bonus > 0 && ` · ${money(payout.bonus)} bonus`}
            {payout.adjustments !== 0 && ` · ${money(payout.adjustments)} adjustments`}
            {payout.method && ` · via ${payout.method}`}
          </p>
          {payout.sentReference && (
            <p className="mt-1 text-[11px] tabular-nums text-neutral-500">ref {payout.sentReference}</p>
          )}
          {payout.failureReason && (
            <p className="mt-1 text-[11px] leading-relaxed text-flag-critical">{payout.failureReason}</p>
          )}
        </div>
        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-white">
          {money(payout.amount)}
        </span>
      </div>

      {batchApproved && !payout.locked && mode === 'none' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode('confirm')} className={`${btnPrimary} ${btnSizeSm}`}>
            Record confirmation
          </button>
          <button type="button" onClick={() => setMode('fail')} className={`${btnSecondary} ${btnSizeSm}`}>
            Flag a failure
          </button>
        </div>
      )}

      {mode === 'confirm' && (
        <form className="mt-3 space-y-3" action={(formData) => run(() => confirmPayoutAction(payout.id, formData))}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor={`ref-${payout.id}`}>
                Provider reference *
              </label>
              <input
                id={`ref-${payout.id}`}
                name="reference"
                required
                className={inputClass}
                placeholder="wise-tx-…"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`m-${payout.id}`}>
                Method
              </label>
              <select
                id={`m-${payout.id}`}
                name="method"
                defaultValue={payout.method ?? 'wise'}
                className={selectClass}
              >
                <option value="wise">Wise</option>
                <option value="payoneer">Payoneer</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="paypal">PayPal</option>
                <option value="crypto_usdc">USDC</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-600">
            Confirming locks this record permanently. It becomes the receipt.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
              Confirm and lock
            </button>
            <button type="button" onClick={() => setMode('none')} className={`${btnSecondary} ${btnSizeSm}`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === 'fail' && (
        <form
          className="mt-3 space-y-3"
          action={(formData) =>
            run(() =>
              failPayoutAction(
                payout.id,
                String(formData.get('reason') ?? ''),
                formData.get('returned') === 'on',
              ),
            )
          }
        >
          <div>
            <label className={labelClass} htmlFor={`fr-${payout.id}`}>
              What went wrong *
            </label>
            <input id={`fr-${payout.id}`} name="reason" required className={inputClass} />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-neutral-300">
            <input type="checkbox" name="returned" className="h-4 w-4 accent-[#9a88fc]" />
            The transfer was returned rather than declined
          </label>
          <p className="text-[11px] leading-relaxed text-neutral-600">
            The amount rolls into the next batch rather than disappearing.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
              Flag it
            </button>
            <button type="button" onClick={() => setMode('none')} className={`${btnSecondary} ${btnSizeSm}`}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {message && (
        <p className={`mt-2.5 text-[13px] ${message.ok ? 'text-flag-good' : 'text-flag-critical'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
