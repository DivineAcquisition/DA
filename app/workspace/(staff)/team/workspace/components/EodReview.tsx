'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { inputClass, labelClass } from '@/app/workspace/(portal)/components/ui';
import { blockerTaskAction, escalateEodAction, excuseDaysAction, feedbackEodAction, reviewEodAction, unlockEodAction } from '@/lib/workspace/sales-eod-actions';

function Result({ error, message }: { error: string | null; message: string | null }) {
  if (error) return <p className="text-sm text-flag-critical">{error}</p>;
  if (message) return <p className="text-sm text-flag-good">{message}</p>;
  return null;
}

export function ReviewForm({ eodId, reviewed }: { eodId: string; reviewed: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (reviewed) return <p className="text-sm text-neutral-400">Reviewed.</p>;
  return (
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          const result = await reviewEodAction(fd);
          if (result.ok) {
            setMessage(result.message);
            router.refresh();
          } else setError(result.error);
        });
      }}
    >
      <input type="hidden" name="eod_id" value={eodId} />
      <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
        Mark reviewed
      </button>
      <Result error={error} message={message} />
    </form>
  );
}

export function FeedbackBox({ eodId }: { eodId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      action={(fd) => {
        setError(null);
        start(async () => {
          const result = await feedbackEodAction(fd);
          if (result.ok) router.refresh();
          else setError(result.error);
        });
      }}
    >
      <input type="hidden" name="eod_id" value={eodId} />
      <label className={labelClass} htmlFor="feedback-body">
        Feedback
      </label>
      <textarea id="feedback-body" name="body" required rows={4} className={inputClass} placeholder="What to keep, what to change." />
      <label className={labelClass} htmlFor="feedback-rating">
        Rating, optional
      </label>
      <select id="feedback-rating" name="rating" defaultValue="" className={inputClass}>
        <option value="">No rating</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
      </select>
      <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
        Send feedback
      </button>
      <p className="text-xs text-neutral-500">Feedback cannot be edited. Send a correction as a new note.</p>
      <Result error={error} message={null} />
    </form>
  );
}

export function EscalateBox({ eodId }: { eodId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      action={(fd) => {
        setError(null);
        start(async () => {
          const result = await escalateEodAction(fd);
          if (result.ok) router.refresh();
          else setError(result.error);
        });
      }}
    >
      <input type="hidden" name="eod_id" value={eodId} />
      <label className={labelClass} htmlFor="escalate-reason">
        Why this needs DA Admin
      </label>
      <textarea id="escalate-reason" name="reason" required minLength={5} rows={3} className={inputClass} />
      <button type="submit" disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
        Escalate to DA Admin
      </button>
      <Result error={error} message={null} />
    </form>
  );
}

export function UnlockBox({ eodId }: { eodId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      action={(fd) => {
        setError(null);
        start(async () => {
          const result = await unlockEodAction(fd);
          if (result.ok) router.refresh();
          else setError(result.error);
        });
      }}
    >
      <input type="hidden" name="eod_id" value={eodId} />
      <label className={labelClass} htmlFor="unlock-hours">
        Hours
      </label>
      <input id="unlock-hours" name="hours" type="number" min={1} max={72} defaultValue={4} required className={inputClass} />
      <label className={labelClass} htmlFor="unlock-reason">
        Reason
      </label>
      <textarea id="unlock-reason" name="reason" required minLength={5} rows={2} className={inputClass} />
      <button type="submit" disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
        Unlock
      </button>
      <Result error={error} message={null} />
    </form>
  );
}

export function BlockerTask({
  eodId,
  operatorId,
  placementId,
  blockers,
  workDate,
  needsHelp,
}: {
  eodId: string;
  operatorId: string;
  placementId: string;
  blockers: string;
  workDate: string;
  needsHelp: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!blockers.trim() || blockers.trim() === 'No blockers today.') return <p className="text-sm text-neutral-500">No blocker to turn into a task.</p>;
  return (
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          const result = await blockerTaskAction(fd);
          if (result.ok) {
            setMessage(result.message);
            router.refresh();
          } else setError(result.error);
        });
      }}
    >
      <input type="hidden" name="eod_id" value={eodId} />
      <input type="hidden" name="operator_id" value={operatorId} />
      <input type="hidden" name="placement_id" value={placementId} />
      <input type="hidden" name="blockers" value={blockers} />
      <input type="hidden" name="work_date" value={workDate} />
      <input type="hidden" name="due_on" value={workDate} />
      <input type="hidden" name="needs_help" value={needsHelp ? 'true' : 'false'} />
      <button type="submit" disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
        Turn blocker into a task
      </button>
      <Result error={error} message={message} />
    </form>
  );
}

export function ExcuseDays({ placementId }: { placementId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      action={(fd) => {
        setError(null);
        start(async () => {
          const result = await excuseDaysAction(fd);
          if (result.ok) {
            setMessage(result.message);
            router.refresh();
          } else setError(result.error);
        });
      }}
    >
      <input type="hidden" name="placement_id" value={placementId} />
      <label className={labelClass} htmlFor="excuse-dates">
        Dates
      </label>
      <input id="excuse-dates" name="dates" required placeholder="2026-10-28, 2026-10-29" className={inputClass} />
      <label className={labelClass} htmlFor="excuse-reason">
        Reason
      </label>
      <select id="excuse-reason" name="reason" defaultValue="time_off" className={inputClass}>
        <option value="time_off">Time off</option>
        <option value="sick">Sick</option>
        <option value="client_closed">Client closed</option>
        <option value="holiday">Holiday</option>
        <option value="system_outage">System outage</option>
        <option value="other">Other</option>
      </select>
      <label className={labelClass} htmlFor="excuse-note">
        Note
      </label>
      <input id="excuse-note" name="note" className={inputClass} />
      <button type="submit" disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
        Excuse these days
      </button>
      <p className="text-xs text-neutral-500">No EOD is due. The operator can see the day. They cannot excuse themselves.</p>
      <Result error={error} message={message} />
    </form>
  );
}
