'use client';

import { blockerTaskAction, escalateEodAction, excuseDaysAction, feedbackEodAction, reviewEodAction, unlockEodAction } from '@/lib/workspace/sales-eod-actions';
import { Field, Input, Select, Textarea } from '../../components/ui';
import ActionForm from '../components/ActionForm';

export function ReviewActions({ eodId, reviewed }: { eodId: string; reviewed: boolean }) {
  if (reviewed) return <p className="text-sm text-[var(--ws-dim)]">Reviewed.</p>;
  return (
    <ActionForm action={reviewEodAction} submitLabel="Mark reviewed">
      <input type="hidden" name="eod_id" value={eodId} />
    </ActionForm>
  );
}

export function FeedbackForm({ eodId }: { eodId: string }) {
  return (
    <ActionForm action={feedbackEodAction} submitLabel="Send feedback" resetOnSuccess>
      <input type="hidden" name="eod_id" value={eodId} />
      <Field label="Feedback">
        <Textarea name="body" required rows={4} placeholder="What to keep, what to change." />
      </Field>
      <Field label="Rating" hint="Optional. 1 to 5.">
        <Select name="rating" defaultValue="">
          <option value="">No rating</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </Select>
      </Field>
    </ActionForm>
  );
}

export function EscalateForm({ eodId }: { eodId: string }) {
  return (
    <ActionForm action={escalateEodAction} submitLabel="Escalate to DA Admin">
      <input type="hidden" name="eod_id" value={eodId} />
      <Field label="Why this needs DA Admin">
        <Textarea name="reason" required minLength={5} rows={3} />
      </Field>
    </ActionForm>
  );
}

export function UnlockForm({ eodId }: { eodId: string }) {
  return (
    <ActionForm action={unlockEodAction} submitLabel="Unlock">
      <input type="hidden" name="eod_id" value={eodId} />
      <Field label="Hours" hint="1 to 72.">
        <Input name="hours" type="number" min={1} max={72} defaultValue={4} required />
      </Field>
      <Field label="Reason">
        <Textarea name="reason" required minLength={5} rows={2} />
      </Field>
    </ActionForm>
  );
}

export function BlockerTaskForm({
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
  if (!blockers.trim() || blockers.trim() === 'No blockers today.') return null;
  return (
    <ActionForm action={blockerTaskAction} submitLabel="Turn blocker into a task">
      <input type="hidden" name="eod_id" value={eodId} />
      <input type="hidden" name="operator_id" value={operatorId} />
      <input type="hidden" name="placement_id" value={placementId} />
      <input type="hidden" name="blockers" value={blockers} />
      <input type="hidden" name="work_date" value={workDate} />
      <input type="hidden" name="due_on" value={workDate} />
      <input type="hidden" name="needs_help" value={needsHelp ? 'true' : 'false'} />
      <p className="text-sm text-[var(--ws-dim)]">Creates one task for the operator from this blocker.</p>
    </ActionForm>
  );
}

export function ExcuseForm({ placementId }: { placementId: string }) {
  return (
    <ActionForm action={excuseDaysAction} submitLabel="Excuse these days" resetOnSuccess>
      <input type="hidden" name="placement_id" value={placementId} />
      <Field label="Dates" hint="One or more working days, comma-separated. YYYY-MM-DD.">
        <Input name="dates" required placeholder="2026-10-28, 2026-10-29" />
      </Field>
      <Field label="Reason">
        <Select name="reason" defaultValue="time_off">
          <option value="time_off">Time off</option>
          <option value="sick">Sick</option>
          <option value="client_closed">Client closed</option>
          <option value="holiday">Holiday</option>
          <option value="system_outage">System outage</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Note">
        <Input name="note" />
      </Field>
    </ActionForm>
  );
}
