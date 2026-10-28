'use client';

import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { completeTaskAction, completeTrainingAction, markNotificationReadAction } from '@/lib/portal/actions';
import { OPERATOR_STATUS, SEVERITY_LABEL, SEVERITY_TONE } from '@/lib/portal/labels';
import { formatDate, formatDateTime } from '@/lib/portal/time';
import type { TasksData } from '@/lib/portal/types';
import { Badge } from '../../components/ui';
import { Card, CardTitle, Empty, Feedback, useAction, usePortal, VaButton } from './portal';

export default function TasksView({ data }: { data: TasksData }) {
  const { context, operatorZone, readOnly } = usePortal();
  const action = useAction();
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const open = data.tasks.filter((t) => !t.completed_on);
  const done = data.tasks.filter((t) => t.completed_on);
  const notifications = data.notifications.filter((n) => (filter === 'all' ? true : filter === 'unread' ? !n.read_at : Boolean(n.read_at)));
  const onboarding = context.onboarding;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tasks &amp; Training</h1>

      {onboarding && onboarding.status === 'pending' ? (
        <Card className="border border-brand-500/30">
          <p className="text-sm font-semibold">Finish your onboarding</p>
          <p className="mt-1 text-sm text-neutral-400">{onboarding.protocol_name} is not finished.</p>
          {onboarding.link_token ? (
            <a href={`/o/${onboarding.link_token}`} className={`${btnPrimary} ${btnSizeSm} mt-3`}>
              Continue onboarding
            </a>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardTitle aside={<Badge tone="brand">{OPERATOR_STATUS[data.status] ?? 'Sales Operator'}</Badge>}>Certification</CardTitle>
        <p className="text-sm text-neutral-300">
          {data.certified_on ? `Certified on ${formatDate(data.certified_on, true)}` : 'Not certified yet'}
          {data.tier ? ` · Tier ${data.tier}` : ''}
        </p>
      </Card>

      <Card>
        <CardTitle>Tasks</CardTitle>
        {open.length === 0 ? <Empty>No open tasks.</Empty> : null}
        <ul className="divide-y divide-white/[0.05]">
          {open.map((task) => (
            <li key={task.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{task.title}</p>
                {task.detail ? <p className="text-xs text-neutral-400">{task.detail}</p> : null}
                <p className="text-xs text-neutral-500">
                  {task.due_on ? `Due ${formatDate(task.due_on)}` : 'No due date'}
                  {task.assigned_by ? ` · from ${task.assigned_by}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {task.overdue ? <Badge tone="critical">Overdue</Badge> : null}
                <VaButton type="button" disabled={action.pending} onClick={() => action.run(() => completeTaskAction(task.id))} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
                  Mark done
                </VaButton>
              </div>
            </li>
          ))}
        </ul>
        {done.length ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-neutral-500">Completed ({done.length})</summary>
            <ul className="mt-2 space-y-1 text-sm text-neutral-500">
              {done.map((task) => (
                <li key={task.id}>
                  {task.title} · done {formatDate(task.completed_on!)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Training</CardTitle>
        {data.training.length === 0 ? <Empty>No training assigned.</Empty> : null}
        <ul className="divide-y divide-white/[0.05]">
          {data.training.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                {item.detail ? <p className="text-xs text-neutral-400">{item.detail}</p> : null}
                {item.material?.url ? (
                  <a href={item.material.url} target="_blank" rel="noreferrer" className="text-xs text-brand-200 underline">
                    Open {item.material.title}
                  </a>
                ) : null}
              </div>
              {item.completed_on ? (
                <Badge tone="good">Done {formatDate(item.completed_on)}</Badge>
              ) : (
                <VaButton type="button" disabled={action.pending} onClick={() => action.run(() => completeTrainingAction(item.id))} className={`${btnSecondary} px-3 py-1.5 text-xs`}>
                  Mark done
                </VaButton>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Feedback message={action.message} error={action.error} />

      <Card>
        <CardTitle
          aside={
            <div className="flex gap-1">
              {(['all', 'unread', 'read'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${filter === value ? 'bg-brand-500 text-ink-950' : 'bg-white/[0.05] text-neutral-400'}`}
                >
                  {value === 'all' ? 'All' : value === 'unread' ? 'Unread' : 'Read'}
                </button>
              ))}
            </div>
          }
        >
          Notifications
        </CardTitle>
        {notifications.length === 0 ? <Empty>Nothing here.</Empty> : null}
        <ul className="space-y-2">
          {notifications.map((item) => (
            <li key={item.id}>
              <details
                className={`rounded-xl px-3 py-2.5 ${item.read_at ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                onToggle={(event) => {
                  if ((event.target as HTMLDetailsElement).open && !item.read_at && !readOnly) void markNotificationReadAction(item.id);
                }}
              >
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                  <span className={item.read_at ? 'text-neutral-400' : 'font-medium text-white'}>{item.title}</span>
                  <Badge tone={SEVERITY_TONE[item.severity] ?? 'neutral'}>{SEVERITY_LABEL[item.severity] ?? 'Info'}</Badge>
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{item.body}</p>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {formatDateTime(item.created_at, operatorZone)}
                  {item.sent_by ? ` · ${item.sent_by}` : ''}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
