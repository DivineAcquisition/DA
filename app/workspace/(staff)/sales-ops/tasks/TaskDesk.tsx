'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import type { ActionResult } from '@/lib/ad/rpc';
import { deleteOperatorTaskAction, saveOperatorTaskAction } from '@/lib/workspace/sales-task-actions';

export type TaskRosterRow = {
  placement_id: string;
  operator_id: string;
  operator_name: string;
  client_name: string;
  status: string;
  manager_name: string | null;
};

export type StaffTask = {
  id: string;
  title: string;
  note: string | null;
  source: string;
  priority: 'normal' | 'high' | string;
  due_on: string | null;
  due_time: string | null;
  status: 'open' | 'done' | string;
  created_by: string;
  created_at: string;
  completed_on: string | null;
};

const field = 'mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white';
const button = 'inline-flex h-10 items-center justify-center rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold text-white disabled:opacity-60';

export default function TaskDesk({
  basePath,
  roster,
  placementId,
  tasks,
  error,
}: {
  basePath: string;
  roster: TaskRosterRow[];
  placementId: string | null;
  tasks: StaffTask[];
  error: string | null;
}) {
  const router = useRouter();
  const selected = roster.find((row) => row.placement_id === placementId) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Operator tasks</h1>
        <p className="mt-1 text-sm text-neutral-400">Create a task for any operator. They get an alert, and the task shows on their dashboard.</p>
      </div>
      {error ? <p className="rounded-2xl border border-red-400/30 px-4 py-3 text-sm text-red-300">{error}</p> : null}
      {roster.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.06] px-5 py-8 text-sm text-neutral-400">No workspace placements yet.</p>
      ) : (
        <>
          <label className="block text-sm text-neutral-300">
            Operator
            <select
              className={field}
              value={selected?.placement_id ?? ''}
              onChange={(event) => router.push(`${basePath}?placement=${event.target.value}`)}
            >
              {roster.map((row) => (
                <option key={row.placement_id} value={row.placement_id}>
                  {row.operator_name} · {row.client_name} · {row.status}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <CreateForm operatorId={selected.operator_id} placementId={selected.placement_id} />
          ) : null}
          <ul className="space-y-2">
            {tasks.length === 0 ? <li className="text-sm text-neutral-400">No tasks on this placement.</li> : null}
            {tasks.map((task) => (
              <li key={task.id} className="rounded-2xl border border-white/[0.06] px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-white">{task.title}</p>
                  <p className="text-xs text-neutral-500">
                    {task.source} · {task.status}
                    {task.priority === 'high' ? ' · high' : ''}
                    {task.due_on ? ` · due ${task.due_on}${task.due_time ? ` ${task.due_time}` : ''}` : ''}
                  </p>
                </div>
                {task.note ? <p className="mt-1 text-sm text-neutral-300">{task.note}</p> : null}
                <p className="mt-1 text-xs text-neutral-500">From {task.created_by}</p>
                {task.source === 'manager' ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-[#937DFF]">Edit</summary>
                    <EditForm task={task} operatorId={selected?.operator_id ?? ''} placementId={selected?.placement_id ?? ''} />
                  </details>
                ) : (
                  <p className="mt-2 text-xs text-neutral-500">System tasks complete when the EOD is submitted.</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CreateForm({ operatorId, placementId }: { operatorId: string; placementId: string }) {
  return (
    <FormBox action={saveOperatorTaskAction} submitLabel="Create task" resetOnSuccess>
      <input type="hidden" name="operator_id" defaultValue={operatorId} />
      <input type="hidden" name="placement_id" defaultValue={placementId} />
      <Field label="Title">
        <input name="title" required minLength={3} maxLength={140} className={field} />
      </Field>
      <Field label="Note">
        <input name="note" maxLength={500} className={field} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Due date">
          <input name="due_on" type="date" className={field} />
        </Field>
        <Field label="Due time">
          <input name="due_time" type="time" className={field} />
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue="normal" className={field}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </Field>
      </div>
    </FormBox>
  );
}

function EditForm({ task, operatorId, placementId }: { task: StaffTask; operatorId: string; placementId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-3 space-y-3">
      <FormBox action={saveOperatorTaskAction} submitLabel="Save changes">
        <input type="hidden" name="id" defaultValue={task.id} />
        <input type="hidden" name="operator_id" defaultValue={operatorId} />
        <input type="hidden" name="placement_id" defaultValue={placementId} />
        <Field label="Title">
          <input name="title" required minLength={3} maxLength={140} defaultValue={task.title} className={field} />
        </Field>
        <Field label="Note">
          <input name="note" maxLength={500} defaultValue={task.note ?? ''} className={field} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Due date">
            <input name="due_on" type="date" defaultValue={task.due_on ?? ''} className={field} />
          </Field>
          <Field label="Due time">
            <input name="due_time" type="time" defaultValue={task.due_time ?? ''} className={field} />
          </Field>
          <Field label="Priority">
            <select name="priority" defaultValue={task.priority} className={field}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" name="done" defaultChecked={task.status === 'done'} />
          Done
        </label>
      </FormBox>
      <button
        type="button"
        disabled={pending}
        className="text-sm text-[#FFB020]"
        onClick={() => {
          if (!window.confirm('Delete this task?')) return;
          const fd = new FormData();
          fd.set('id', task.id);
          setError(null);
          start(async () => {
            const result = await deleteOperatorTaskAction(fd);
            if (!result.ok) setError(result.error);
            else router.refresh();
          });
        }}
      >
        Delete
      </button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-neutral-300">
      {label}
      {children}
    </label>
  );
}

function FormBox({
  action,
  submitLabel,
  resetOnSuccess = false,
  children,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  resetOnSuccess?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3 rounded-2xl border border-white/[0.06] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const fd = new FormData(form);
        setError(null);
        start(async () => {
          const result = await action(fd);
          if (!result.ok) setError(result.error);
          else {
            if (resetOnSuccess) form.reset();
            router.refresh();
          }
        });
      }}
    >
      {children}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button type="submit" disabled={pending} className={button}>
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
