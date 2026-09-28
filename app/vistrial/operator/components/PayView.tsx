'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { askPayQuestionAction, markPayAnswerReadAction } from '@/lib/portal/actions';
import { bookingState, PAYOUT_METHOD, payoutStatus } from '@/lib/portal/labels';
import { formatDate, formatDateTime, formatMoney } from '@/lib/portal/time';
import type { Statement } from '@/lib/portal/types';
import { Badge, inputClass } from '../../components/ui';
import { Card, Empty, Feedback, useAction, usePortal, VaButton } from './portal';

/** The VA's own money: what each statement is made of, and where each payout is. */
export default function PayView({ statements }: { statements: Statement[] }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pay</h1>
      {statements.length === 0 ? <Empty>No pay statements yet. They appear once DA runs payroll for a period.</Empty> : null}
      {statements.map((statement) => (
        <StatementCard key={statement.id} statement={statement} />
      ))}
    </div>
  );
}

function StatementCard({ statement }: { statement: Statement }) {
  const { operatorZone, readOnly } = usePortal();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const action = useAction();
  const period =
    statement.period_start && statement.period_end
      ? `${formatDate(statement.period_start)} – ${formatDate(statement.period_end, true)}`
      : 'Pay period';

  return (
    <Card>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-semibold text-white">{period}</p>
          <p className="text-xs text-neutral-500">{statement.client_name}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">{formatMoney(statement.total)}</p>
          <Badge tone={statement.locked ? 'good' : 'warning'}>{statement.locked ? 'Final' : 'Open: can still change'}</Badge>
        </div>
      </button>

      {open ? (
        <div className="mt-4 space-y-3 text-sm">
          <Line label="Base pay" amount={statement.base_amount} detail={statement.base_detail} />
          <Line label="Commission" amount={statement.commission_amount} detail={statement.commission_detail} />
          {statement.commission_bookings.length > 0 ? (
            <ul className="ml-3 space-y-1 border-l border-white/10 pl-3">
              {statement.commission_bookings.map((booking) => (
                <li key={booking.id}>
                  <Link href={`/vistrial/operator/bookings/${booking.id}`} className="text-xs text-brand-200 underline">
                    {booking.customer}, {formatDateTime(booking.scheduled_for, operatorZone)}
                  </Link>
                  <span className="text-xs text-neutral-500"> · {bookingState(booking.state).label}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <Line label="Speed bonus" amount={statement.speed_bonus_amount} detail={statement.speed_bonus_detail} />
          {statement.adjustments.map((adjustment, index) => (
            <Line key={index} label={adjustment.label} amount={adjustment.amount} detail={adjustment.reason} />
          ))}
          <div className="flex items-center justify-between border-t border-white/10 pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(statement.total)}</span>
          </div>
          <p className="text-xs text-neutral-500">
            {statement.locked
              ? `Locked${statement.locked_at ? ` on ${formatDate(statement.locked_at.slice(0, 10), true)}` : ''}. These numbers are final.`
              : 'This statement is still open, so these numbers can change until the period closes.'}
          </p>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Payouts</p>
            {statement.payouts.length === 0 ? <p className="text-xs text-neutral-500">Not paid out yet.</p> : null}
            <ul className="space-y-2">
              {statement.payouts.map((payout) => {
                const status = payoutStatus(payout.status);
                return (
                  <li key={payout.id} className="rounded-xl bg-white/[0.03] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="tabular-nums">{formatMoney(payout.amount)}</span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      {status.detail}
                      {payout.sent_at ? `. Sent ${formatDateTime(payout.sent_at, operatorZone)} by ${PAYOUT_METHOD[payout.method] ?? 'your payout method'}` : ''}
                      {payout.confirmed_at ? `. Confirmed ${formatDateTime(payout.confirmed_at, operatorZone)}` : ''}
                    </p>
                    {payout.failure_reason ? <p className="mt-1 text-xs text-flag-critical">Why: {payout.failure_reason}</p> : null}
                    {payout.rolled_into_period ? (
                      <p className="mt-1 text-xs text-neutral-400">This amount was moved into your payout for period {payout.rolled_into_period}.</p>
                    ) : null}
                    {payout.rolled_from_period ? (
                      <p className="mt-1 text-xs text-neutral-400">Includes an amount carried over from period {payout.rolled_from_period}.</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Questions</p>
            <ul className="space-y-2">
              {statement.questions.map((q) => (
                <li key={q.id} className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                  <p className="text-neutral-300">“{q.body}”</p>
                  <p className="text-[11px] text-neutral-500">Asked {formatDateTime(q.asked_at, operatorZone)}</p>
                  {q.answer ? (
                    <div className="mt-1.5 rounded-lg bg-flag-good/[0.08] px-2.5 py-2">
                      <p className="text-neutral-100">{q.answer}</p>
                      <p className="text-[11px] text-neutral-500">
                        {q.answered_by ?? 'DA'}
                        {q.answered_at ? `, ${formatDateTime(q.answered_at, operatorZone)}` : ''}
                      </p>
                      {q.unread && !readOnly ? (
                        <button type="button" onClick={() => void markPayAnswerReadAction(q.id)} className="mt-1 text-[11px] underline">
                          Mark as read
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-flag-warning">Waiting for an answer</p>
                  )}
                </li>
              ))}
            </ul>
            {asking ? (
              <div className="mt-2">
                <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} className={inputClass} placeholder="What would you like to know about this statement?" />
                <div className="mt-2 flex gap-2">
                  <VaButton
                    type="button"
                    disabled={action.pending || question.trim().length < 5}
                    onClick={() =>
                      action.run(() => askPayQuestionAction(statement.id, question), (r) => {
                        if (r.ok) {
                          setQuestion('');
                          setAsking(false);
                        }
                      })
                    }
                    className={`${btnPrimary} ${btnSizeSm}`}
                  >
                    Send to DA
                  </VaButton>
                  <button type="button" onClick={() => setAsking(false)} className={`${btnSecondary} ${btnSizeSm}`}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <VaButton type="button" onClick={() => setAsking(true)} className={`${btnSecondary} mt-2 px-3 py-1.5 text-xs`} showReason>
                Question about this statement
              </VaButton>
            )}
            <Feedback message={action.message} error={action.error} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function Line({ label, amount, detail }: { label: string; amount: number; detail: string | null }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-neutral-200">{label}</span>
        <span className="tabular-nums text-neutral-100">{formatMoney(amount)}</span>
      </div>
      {detail ? <p className="text-xs text-neutral-500">{detail}</p> : null}
    </div>
  );
}
