'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDateTime } from '@/lib/vistrial/format';
import {
  CHANNEL_LABELS,
  FALLBACK_ORDER,
  SEVERITY_LABELS,
  SEVERITY_ROUTING,
} from '@/lib/vistrial/rules/notifications';
import { useOps } from '@/lib/vistrial/store';
import type { NotificationSeverity } from '@/lib/vistrial/types';
import { AdminOnly } from '../../components/AppShell';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
} from '../../components/ui';

const SEVERITIES: NotificationSeverity[] = ['informational', 'important', 'urgent'];

export default function NotificationsPage() {
  return (
    <AdminOnly>
      <NotificationLog />
    </AdminOnly>
  );
}

function NotificationLog() {
  const { gateway } = useOps();
  const [filter, setFilter] = useState<NotificationSeverity | 'all'>('all');

  const all = gateway.allNotifications();
  const shown = filter === 'all' ? all : all.filter((item) => item.severity === filter);

  const failures = all.filter((item) => item.attempts.some((attempt) => attempt.status === 'failed'));
  const unreceived = all.filter((item) => !item.attempts.some((attempt) => attempt.status === 'delivered'));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Notifications"
        title="Delivery log"
        description="One engine, four channels. Severity decides routing, and every send attempt is logged with its status — when a placement is going wrong, the question is whether the operator was actually told."
      />

      <StatGrid columns={3}>
        <StatTile label="Sent" value={String(all.length)} />
        <StatTile
          label="Channel failures"
          value={String(failures.length)}
          hint="Fell back to the next channel"
          tone={failures.length > 0 ? 'warning' : 'good'}
        />
        <StatTile
          label="Never received"
          value={String(unreceived.length)}
          hint="Delivered on no channel at all"
          tone={unreceived.length > 0 ? 'critical' : 'good'}
        />
      </StatGrid>

      <section>
        <SectionHeader title="Routing table" hint="WhatsApp is reserved for urgent so it keeps its weight." />
        <Panel className="divide-y divide-white/[0.05] px-5">
          {SEVERITIES.map((severity) => (
            <div key={severity} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <Badge
                tone={severity === 'urgent' ? 'critical' : severity === 'important' ? 'warning' : 'neutral'}
              >
                {SEVERITY_LABELS[severity]}
              </Badge>
              <div className="flex flex-wrap gap-1.5">
                {FALLBACK_ORDER.map((channel) => {
                  const routed = SEVERITY_ROUTING[severity].includes(channel);
                  return (
                    <span
                      key={channel}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                        routed
                          ? 'border-brand-500/30 bg-brand-500/[0.12] text-brand-200'
                          : 'border-white/[0.07] text-neutral-600'
                      }`}
                    >
                      {CHANNEL_LABELS[channel]}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </Panel>
        <p className="mt-2.5 text-xs leading-relaxed text-neutral-500">
          Operators can set a preferred channel, which moves to the front of the order. Urgent notifications
          ignore preference and go everywhere.
        </p>
      </section>

      <section>
        <SectionHeader
          title="Sent"
          actions={
            <div className="flex gap-1 overflow-x-auto">
              {(['all', ...SEVERITIES] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    filter === option
                      ? 'bg-brand-500/[0.14] text-brand-100 ring-1 ring-inset ring-brand-500/25'
                      : 'text-neutral-500 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {option === 'all' ? 'Everything' : SEVERITY_LABELS[option]}
                </button>
              ))}
            </div>
          }
        />

        {shown.length === 0 ? (
          <EmptyState title="Nothing sent at this severity" />
        ) : (
          <ul className="space-y-2.5">
            {shown.map((notification) => (
              <li key={notification.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          notification.severity === 'urgent'
                            ? 'critical'
                            : notification.severity === 'important'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {SEVERITY_LABELS[notification.severity]}
                      </Badge>
                      <Link
                        href={`/vistrial/admin/operators/${notification.operatorId}`}
                        className="text-xs text-neutral-400 hover:text-brand-200"
                      >
                        {gateway.operatorName(notification.operatorId)}
                      </Link>
                      <span className="text-[11px] text-neutral-600">from {notification.sentBy}</span>
                    </div>
                    <span className="text-[11px] tabular-nums text-neutral-600">
                      {formatDateTime(notification.createdAt)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-medium text-white">{notification.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">{notification.body}</p>

                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {notification.attempts.map((attempt) => (
                      <li key={attempt.channel} title={attempt.detail ?? undefined}>
                        <Badge
                          tone={
                            attempt.status === 'delivered'
                              ? 'good'
                              : attempt.status === 'failed'
                                ? 'critical'
                                : 'neutral'
                          }
                        >
                          {CHANNEL_LABELS[attempt.channel]} · {attempt.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-2.5 text-[11px] text-neutral-600">
                    {notification.readAt
                      ? `Read ${formatDateTime(notification.readAt)}`
                      : 'Not yet opened in-app'}
                  </p>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
