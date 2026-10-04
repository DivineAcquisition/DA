import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyHoldSession } from '@/lib/academy/access';
import {
  addHoldNote,
  assignHold,
  confirmHoldRelease,
  reopenHold,
  requestHoldRelease,
  resolveHold,
  saveHoldChecklist,
} from '@/lib/academy/holdActions';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input, Select, Textarea } from '../../../components/ui';

type Concept = { concept: string; count: number };
type Lesson = {
  id: string;
  code: string;
  title: string;
  module_order: number;
  module_title: string;
  time_spent_seconds: number;
  length_seconds: number;
  completed: boolean;
  reopen_required: boolean;
  reopened: boolean;
};
type Attempt = {
  attempt_number: number;
  started_at: string;
  finished_at: string | null;
  score: number | null;
  time_taken_seconds: number | null;
  gap_seconds: number | null;
  flagged_fast: boolean;
  rushed: boolean;
  concepts: string[];
};
type Choice = { id: string; code?: string; title: string; module_order?: number; order?: number };
type Detail = {
  id: string;
  status: string;
  outcome: string | null;
  opened_at: string;
  deadline_at: string | null;
  overdue: boolean;
  days_open: number;
  review_started_at: string | null;
  resolved_at: string | null;
  trainee_name: string;
  self: boolean;
  program: string;
  track: string;
  start_date: string | null;
  manager_name: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  quiz_kind: string;
  quiz_label: string;
  module_title: string | null;
  attempts_used: number;
  concepts: Concept[];
  pattern: string | null;
  module_scores: { order: number; title: string; correct: number; total: number }[];
  lessons: Lesson[];
  attempts: Attempt[];
  notes: { id: string; body: string; created_at: string; author: string }[];
  history: { id: string; status: string; outcome: string | null; opened_at: string; resolved_at: string | null; plan: string | null }[];
  checklist: {
    call_held_on: string | null;
    call_note: string | null;
    concept_check_note: string | null;
    struggle_reason: string | null;
    struggle_note: string | null;
    ready: boolean;
  };
  plan: string | null;
  attempts_granted: number | null;
  retest_on: string | null;
  selected_lessons: string[];
  selected_modules: string[];
  lesson_choices: Choice[];
  module_choices: Choice[];
  release_requested_at: string | null;
  release_requested_by: string | null;
  release_reason: string | null;
  release_note: string | null;
  default_attempts: number;
  struggle_reasons: string[];
  release_reasons: string[];
  reviewers: { id: string; name: string }[];
};

function minutes(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)} min`;
}

export const metadata = { title: 'Hold review' };

export default async function HoldReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ holdId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await academyHoldSession();
  if (!session) redirect('/workspace/login');
  const { holdId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  await controlRpc(supabase, 'academy_hold_begin', { p_hold_id: holdId });
  const { data, error } = await controlRpc<Detail>(supabase, 'academy_hold_detail', { p_hold_id: holdId });
  if (!data) {
    return (
      <div className="space-y-3">
        <Link href="/workspace/academy/holds" className="text-sm text-neutral-400">
          Back to holds
        </Link>
        <p className="text-sm text-neutral-300">{error?.message ?? 'This hold is not open to you.'}</p>
      </div>
    );
  }

  const open = data.status !== 'resolved';
  const ready = data.checklist.ready && data.notes.length > 0 && !data.self;
  const statusLabel = data.status === 'under_review' ? 'Under Review' : data.status === 'resolved' ? 'Resolved' : 'Open';

  return (
    <div className="space-y-8">
      <div>
        <Link href="/workspace/academy/holds" className="text-sm text-neutral-400">
          Back to holds
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-white">{data.trainee_name}</h1>
          <span className="text-sm text-neutral-300">{statusLabel}</span>
          {data.overdue ? <span className="text-sm font-semibold text-amber-300">Overdue</span> : null}
          {!data.reviewer_id ? <span className="text-sm font-semibold text-amber-300">No reviewer</span> : null}
        </div>
        <p className="mt-2 text-sm text-neutral-300">
          {data.program}
          {data.track ? ` · ${data.track}` : ''}
          {data.start_date ? ` · started ${data.start_date}` : ''}
          {` · manager ${data.manager_name}`}
        </p>
        <p className="mt-1 text-sm text-neutral-300">
          {data.quiz_label}
          {data.module_title ? ` · ${data.module_title}` : ''} · {data.attempts_used} attempts · opened{' '}
          {new Date(data.opened_at).toLocaleString()} · {data.days_open} days open
          {data.reviewer_name ? ` · reviewer ${data.reviewer_name}` : ''}
        </p>
        {data.review_started_at ? (
          <p className="mt-1 text-sm text-neutral-400">Review started {new Date(data.review_started_at).toLocaleString()}.</p>
        ) : null}
      </div>

      {query.error ? <p className="text-sm text-flag-critical">{query.error}</p> : null}
      {data.self ? <p className="text-sm text-neutral-200">You cannot resolve a hold on your own enrollment.</p> : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Where the understanding broke</h2>
        {data.pattern ? <p className="text-sm text-white">{data.pattern}</p> : <p className="text-sm text-neutral-400">No missed concepts were recorded.</p>}
        <ul className="space-y-1 text-sm text-neutral-300">
          {data.concepts.map((concept) => (
            <li key={concept.concept}>
              {concept.concept}: missed {concept.count} {concept.count === 1 ? 'time' : 'times'}
            </li>
          ))}
        </ul>
        {data.quiz_kind === 'final' ? (
          <ul className="space-y-1 text-sm text-neutral-300">
            {data.module_scores.map((score) => (
              <li key={score.order}>
                Module {score.order}. {score.title}: {score.correct} of {score.total}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">How they studied</h2>
        {data.lessons.length === 0 ? <p className="text-sm text-neutral-400">No published lessons in this module.</p> : null}
        <ul className="space-y-2 text-sm text-neutral-300">
          {data.lessons.map((lesson) => (
            <li key={lesson.id}>
              {lesson.code} {lesson.title}: {minutes(lesson.time_spent_seconds)} spent / {minutes(lesson.length_seconds)} lesson
              {lesson.completed ? ' · finished' : ' · not finished'}
              {lesson.reopen_required ? (lesson.reopened ? ' · reopened between attempts' : ' · not reopened between attempts') : ''}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">How they attempted</h2>
        <ol className="space-y-2 text-sm text-neutral-300">
          {data.attempts.map((attempt) => (
            <li key={attempt.attempt_number}>
              Attempt {attempt.attempt_number}: {new Date(attempt.started_at).toLocaleString()} · score {attempt.score ?? 0} ·{' '}
              {attempt.time_taken_seconds === null ? 'time unknown' : minutes(attempt.time_taken_seconds)}
              {attempt.gap_seconds === null ? '' : ` · ${minutes(attempt.gap_seconds)} after the previous attempt`}
              {attempt.concepts.length > 0 ? ` · missed ${attempt.concepts.join(', ')}` : ''}
              {attempt.flagged_fast ? ' · faster than the minimum time per question' : ''}
              {attempt.rushed ? ' · rushed back to back' : ''}
            </li>
          ))}
        </ol>
      </section>

      {data.history.length > 1 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-white">Earlier holds</h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            {data.history
              .filter((item) => item.id !== data.id)
              .map((item) => (
                <li key={item.id}>
                  <Link href={`/workspace/academy/holds/${item.id}`} className="text-white">
                    {new Date(item.opened_at).toLocaleDateString()}
                  </Link>
                  {item.outcome ? ` · ${item.outcome}` : ` · ${item.status}`}
                  {item.plan ? ` · ${item.plan}` : ''}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {session.manage && open ? (
        <form action={assignHold} className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 p-4">
          <input type="hidden" name="hold" value={data.id} />
          <Field label="Assign reviewer">
            <Select name="reviewer" defaultValue={data.reviewer_id ?? ''}>
              <option value="">Choose</option>
              {data.reviewers.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.id}>
                  {reviewer.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Assign</Button>
        </form>
      ) : null}

      {open && !data.self ? (
        <form action={saveHoldChecklist} className="grid gap-3 rounded-2xl border border-white/10 p-4">
          <h2 className="text-lg font-semibold text-white">Review checklist</h2>
          <input type="hidden" name="hold" value={data.id} />
          <Field label="Review call date">
            <Input name="call_on" type="date" defaultValue={data.checklist.call_held_on ?? ''} required />
          </Field>
          <Field label="How the call went">
            <Textarea name="call_note" rows={3} defaultValue={data.checklist.call_note ?? ''} required />
          </Field>
          <Field label="How they explained the missed concept">
            <Textarea name="concept_note" rows={3} defaultValue={data.checklist.concept_check_note ?? ''} required />
          </Field>
          <Field label="Why they struggled">
            <Select name="reason" defaultValue={data.checklist.struggle_reason ?? ''} required>
              <option value="">Choose</option>
              {data.struggle_reasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note on why">
            <Textarea name="struggle_note" rows={3} defaultValue={data.checklist.struggle_note ?? ''} required />
          </Field>
          <Button type="submit" className="w-fit">
            Save checklist
          </Button>
        </form>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Notes</h2>
        <ul className="space-y-2 text-sm text-neutral-300">
          {data.notes.length === 0 ? <li>No notes yet.</li> : null}
          {data.notes.map((note) => (
            <li key={note.id}>
              <span className="text-white">{note.author}</span> · {new Date(note.created_at).toLocaleString()}
              <p className="mt-1">{note.body}</p>
            </li>
          ))}
        </ul>
        {open && !data.self ? (
          <form action={addHoldNote} className="space-y-3">
            <input type="hidden" name="hold" value={data.id} />
            <Textarea name="body" rows={3} placeholder="Add a review note" required />
            <Button type="submit">Add note</Button>
          </form>
        ) : null}
      </section>

      {open && !data.self ? (
        ready ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <form action={resolveHold} className="space-y-3 rounded-2xl border border-white/10 p-4">
              <h2 className="text-lg font-semibold text-white">Reset</h2>
              <input type="hidden" name="hold" value={data.id} />
              <input type="hidden" name="outcome" value="reset" />
              <Field label="Remediation plan">
                <Textarea name="plan" rows={4} required />
              </Field>
              <Field label="Additional attempts" hint={`Default ${data.default_attempts}`}>
                <Input name="attempts" type="number" min={1} max={20} defaultValue={data.default_attempts} />
              </Field>
              <PlanLinks detail={data} />
              <Button type="submit">Reset</Button>
            </form>
            <form action={resolveHold} className="space-y-3 rounded-2xl border border-white/10 p-4">
              <h2 className="text-lg font-semibold text-white">Extend</h2>
              <input type="hidden" name="hold" value={data.id} />
              <input type="hidden" name="outcome" value="extend" />
              <Field label="Remediation plan">
                <Textarea name="plan" rows={4} required />
              </Field>
              <Field label="Re-test date">
                <Input name="retest" type="date" required />
              </Field>
              <Field label="Additional attempts" hint={`Default ${data.default_attempts}`}>
                <Input name="attempts" type="number" min={1} max={20} defaultValue={data.default_attempts} />
              </Field>
              <PlanLinks detail={data} />
              <Button type="submit">Extend</Button>
            </form>
            <form action={requestHoldRelease} className="space-y-3 rounded-2xl border border-white/10 p-4">
              <h2 className="text-lg font-semibold text-white">Release</h2>
              <p className="text-sm text-neutral-400">An Academy Admin confirms this. One person cannot release alone.</p>
              <input type="hidden" name="hold" value={data.id} />
              <Field label="Reason">
                <Select name="reason" required defaultValue="">
                  <option value="">Choose</option>
                  {data.release_reasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Note">
                <Textarea name="note" rows={4} required />
              </Field>
              <Button type="submit" variant="danger">
                Request release
              </Button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-neutral-300">Finish the checklist and add a note before choosing an outcome.</p>
        )
      ) : null}

      {data.release_requested_at && open ? (
        <section className="space-y-2 rounded-2xl border border-white/10 p-4">
          <h2 className="text-lg font-semibold text-white">Release requested</h2>
          <p className="text-sm text-neutral-300">
            {data.release_reason}. {data.release_note}
          </p>
          {session.manage && data.release_requested_by !== session.userId ? (
            <form action={confirmHoldRelease}>
              <input type="hidden" name="hold" value={data.id} />
              <Button type="submit" variant="danger">
                Confirm release
              </Button>
            </form>
          ) : (
            <p className="text-sm text-neutral-400">Waiting for a different Academy Admin to confirm.</p>
          )}
        </section>
      ) : null}

      {data.status === 'resolved' ? (
        <section className="space-y-2 rounded-2xl border border-white/10 p-4">
          <h2 className="text-lg font-semibold text-white">Resolved: {data.outcome}</h2>
          {data.plan ? <p className="text-sm text-neutral-300">{data.plan}</p> : null}
          {data.attempts_granted !== null ? <p className="text-sm text-neutral-300">Attempts granted: {data.attempts_granted}.</p> : null}
          {data.retest_on ? <p className="text-sm text-neutral-300">Re-test date: {data.retest_on}.</p> : null}
          {data.release_reason ? (
            <p className="text-sm text-neutral-300">
              {data.release_reason}. {data.release_note}
            </p>
          ) : null}
          {data.resolved_at ? <p className="text-sm text-neutral-400">Resolved {new Date(data.resolved_at).toLocaleString()}.</p> : null}
          {session.manage ? (
            <form action={reopenHold} className="space-y-3">
              <input type="hidden" name="hold" value={data.id} />
              <Field label="Why this is being reopened">
                <Textarea name="note" rows={3} required />
              </Field>
              <Button type="submit" variant="secondary">
                Reopen
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function PlanLinks({ detail }: { detail: Detail }) {
  if (detail.lesson_choices.length === 0 && detail.module_choices.length === 0) return null;
  return (
    <div className="space-y-2 text-sm text-neutral-300">
      {detail.module_choices.length > 0 ? <p className="text-white">Modules to review</p> : null}
      {detail.module_choices.map((module) => (
        <label key={module.id} className="flex gap-2">
          <input type="checkbox" name="module" value={module.id} defaultChecked={detail.selected_modules.includes(module.id)} />
          Module {module.order}. {module.title}
        </label>
      ))}
      {detail.lesson_choices.length > 0 ? <p className="text-white">Lessons to reopen</p> : null}
      {detail.lesson_choices.map((lesson) => (
        <label key={lesson.id} className="flex gap-2">
          <input type="checkbox" name="lesson" value={lesson.id} defaultChecked={detail.selected_lessons.includes(lesson.id)} />
          {lesson.code} {lesson.title}
        </label>
      ))}
    </div>
  );
}
