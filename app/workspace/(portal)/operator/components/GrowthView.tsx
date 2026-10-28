'use client';

import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { ackFeedbackAction, selfReviewAction } from '@/lib/portal/actions';
import { formatDate } from '@/lib/portal/time';
import type { Feedback as FeedbackRow, GrowthData } from '@/lib/portal/types';
import { Badge, inputClass, Meter } from '../../components/ui';
import { Card, CardTitle, Empty, Feedback, useAction, VaButton, VaFieldset } from './portal';

/** Growth: the tier ladder, weekly feedback, and the weekly self-review. */
export default function GrowthView({ data }: { data: GrowthData }) {
  const p = data.progress;
  const met = p.criteria.filter((c) => c.met).length;
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle aside={<Badge tone="brand">{data.tier != null ? `Tier ${data.tier}` : 'Tier not set'}</Badge>}>Your tier</CardTitle>
        {p.next_tier ? (
          <>
            <p className="text-sm text-neutral-300">
              Tier {p.next_tier}: {met} of {p.criteria.length} criteria met.
              {p.eligible ? ' You meet every criterion. An admin reviews it and decides; you will see their reason.' : ''}
            </p>
            {p.criteria.length > 0 ? <div className="mt-2"><Meter value={met / p.criteria.length} /></div> : null}
            <ul className="mt-3 space-y-1.5">
              {p.criteria.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                  <span className="text-neutral-200">{c.label}</span>
                  <span className={`text-xs ${c.met ? 'text-flag-good' : 'text-neutral-500'}`}>
                    {c.kind === 'training_complete' ? (c.met ? 'Done' : 'Not yet') : `${c.current} of ${c.threshold}`}
                  </span>
                </li>
              ))}
            </ul>
            {p.criteria.length === 0 ? <p className="text-sm text-neutral-500">DA has not set criteria for the next tier yet.</p> : null}
          </>
        ) : (
          <p className="text-sm text-neutral-300">You are at the top tier.</p>
        )}
        {data.decisions.length > 0 ? (
          <div className="mt-4">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Tier history</h3>
            <ul className="space-y-1.5 text-sm">
              {data.decisions.map((d, i) => (
                <li key={i} className="rounded-xl bg-white/[0.03] px-3 py-2">
                  <span className="text-neutral-200">
                    Tier {d.to_tier} {d.decision === 'approved' ? 'approved' : 'declined'}
                  </span>
                  <span className="text-xs text-neutral-500"> · {formatDate(d.decided_at.slice(0, 10), true)} by {d.decided_by ?? 'DA'}</span>
                  <p className="text-xs text-neutral-400">{d.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <SelfReview data={data} />

      <Card>
        <CardTitle>Weekly feedback</CardTitle>
        {data.feedback.length === 0 ? <Empty>Your manager posts feedback each week by Monday end of day.</Empty> : null}
        <ul className="space-y-3">
          {data.feedback.map((f) => (
            <FeedbackItem key={f.id} feedback={f} />
          ))}
        </ul>
      </Card>
    </div>
  );
}

function SelfReview({ data }: { data: GrowthData }) {
  const [line, setLine] = useState(data.self_review?.focus_line ?? '');
  const action = useAction();
  const s = data.week_summary;
  return (
    <Card>
      <div id="self-review" />
      <CardTitle aside={<span className="text-xs text-neutral-500">Week of {formatDate(data.week_start)}</span>}>Your week</CardTitle>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/[0.03] p-2.5">
          <p className="text-lg font-semibold text-white">{s.shifts_worked}</p>
          <p className="text-[11px] text-neutral-400">shifts drafted</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-2.5">
          <p className="text-lg font-semibold text-white">{s.reviews_confirmed}</p>
          <p className="text-[11px] text-neutral-400">reviews confirmed</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-2.5">
          <p className="text-lg font-semibold text-white">{s.bookings}</p>
          <p className="text-[11px] text-neutral-400">bookings counted</p>
        </div>
      </div>
      {s.reflections.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-xs text-neutral-400">
          {s.reflections.map((r) => (
            <li key={r.shift_date} className="rounded-xl bg-white/[0.02] px-3 py-2">
              <span className="text-neutral-300">{formatDate(r.shift_date)}:</span> {[r.went_well, r.differently, r.in_way].filter(Boolean).join(' · ')}
            </li>
          ))}
        </ul>
      ) : null}
      <VaFieldset className="mt-4">
        <label className="block">
          <span className="mb-1.5 block text-sm text-neutral-200">What will you focus on next week?</span>
          <input value={line} onChange={(e) => setLine(e.target.value)} maxLength={300} className={inputClass} placeholder="One short line" />
        </label>
        <button
          type="button"
          disabled={action.pending || line.trim().length < 3}
          onClick={() => action.run(() => selfReviewAction(line))}
          className={`${btnPrimary} ${btnSizeSm} mt-2`}
        >
          {data.self_review ? 'Update' : 'Save'}
        </button>
        <p className="mt-1.5 text-[11px] text-neutral-500">Your manager reads this before writing your feedback.</p>
      </VaFieldset>
      <Feedback message={action.message} error={action.error} />
    </Card>
  );
}

function FeedbackItem({ feedback }: { feedback: FeedbackRow }) {
  const [reply, setReply] = useState('');
  const action = useAction();
  return (
    <li id={`feedback-${feedback.id}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">Week of {formatDate(feedback.week_start)}</p>
        <span className="text-xs text-neutral-500">{feedback.author}</span>
      </div>
      <dl className="mt-2 space-y-2 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Keep doing</dt>
          <dd className="text-neutral-200">{feedback.keep_doing}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Improve</dt>
          <dd className="text-neutral-200">{feedback.improve}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Next week&apos;s focus</dt>
          <dd className="text-brand-100">{feedback.focus}</dd>
        </div>
      </dl>
      {feedback.reply ? <p className="mt-2 text-xs text-neutral-400">Your reply: {feedback.reply}</p> : null}
      {!feedback.acknowledged_at || !feedback.reply ? (
        <VaFieldset className="mt-3">
          {!feedback.reply ? (
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              maxLength={1000}
              className={inputClass}
              placeholder="Reply once (optional)"
            />
          ) : null}
          <VaButton
            type="button"
            disabled={action.pending || (Boolean(feedback.acknowledged_at) && reply.trim().length === 0)}
            onClick={() => action.run(() => ackFeedbackAction(feedback.id, reply))}
            className={`${feedback.acknowledged_at ? btnSecondary : btnPrimary} ${btnSizeSm} mt-2`}
          >
            {feedback.acknowledged_at ? 'Send reply' : reply.trim() ? 'Acknowledge and reply' : 'Acknowledge'}
          </VaButton>
        </VaFieldset>
      ) : (
        <p className="mt-2 text-[11px] text-neutral-500">Acknowledged {formatDate(feedback.acknowledged_at.slice(0, 10))}</p>
      )}
      <Feedback message={action.message} error={action.error} />
    </li>
  );
}
