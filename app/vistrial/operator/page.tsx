'use client';

import Link from 'next/link';
import { btnPrimary, btnSecondary, btnSizeMd, btnSizeSm } from '@/app/components/ui';
import { addDays } from '@/lib/vistrial/dates';
import { formatDateTime, formatDay, formatMoney, formatPercent } from '@/lib/vistrial/format';
import { isEscalationOverdue } from '@/lib/vistrial/rules/metrics';
import { SEVERITY_LABELS } from '@/lib/vistrial/rules/notifications';
import { useOps } from '@/lib/vistrial/store';
import {
  Badge,
  EmptyState,
  Meter,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
} from '../components/ui';
import BenchState from './components/BenchState';
import PlacementSwitcher from './components/PlacementSwitcher';

/**
 * The operator lands on their active placement. A work surface, not a dashboard
 * of charts: what is true right now, and the three things they can do about it.
 */
export default function OperatorHome() {
  const { gateway, actor, activePlacement } = useOps();

  if (gateway.isAdmin) {
    return (
      <EmptyState
        title="You are signed in as the admin"
        detail="Switch to an operator workspace to see the shift surface."
        action={
          <Link href="/vistrial/admin" className={`${btnSecondary} ${btnSizeSm}`}>
            Go to the admin view
          </Link>
        }
      />
    );
  }

  if (!activePlacement) return <BenchState />;

  const client = gateway.client(activePlacement.clientId)!;
  const metrics = gateway.metricsFor(activePlacement.id);
  const operator = gateway.operator(actor.id)!;

  const today = gateway.today;
  const yesterday = addDays(today, -1);
  const submittedToday = gateway
    .currentReportsFor(activePlacement.id)
    .some((report) => report.shiftDate === today);
  const missedYesterday = metrics.missedEodDates.includes(yesterday);

  const tasks = gateway.tasksFor(actor.id).filter((task) => !task.completedOn);
  const notifications = gateway.notificationsFor(actor.id).filter((item) => !item.readAt);
  const myEscalations = gateway
    .escalationsFor(activePlacement.id)
    .filter((item) => item.status === 'open');
  const pending = gateway.pendingFor(activePlacement.id);

  const aboveQuota = Math.max(0, metrics.confirmedBookings - metrics.monthlyQuota);

  return (
    <div>
      <PlacementSwitcher />

      <PageHeader
        eyebrow={client.name}
        title={`Your shift, ${operator.name.split(' ')[0]}`}
        description={`${activePlacement.shiftStart} – ${activePlacement.shiftEnd} ${activePlacement.timeZone.replace('_', ' ')} · your time zone is ${operator.timeZone.replace('_', ' ')}`}
        actions={
          <>
            <Link
              href="/vistrial/operator/eod"
              className={`${submittedToday ? btnSecondary : btnPrimary} ${submittedToday ? btnSizeSm : btnSizeMd}`}
            >
              {submittedToday ? 'EOD filed for today' : 'Submit today\u2019s EOD'}
            </Link>
            <Link href="/vistrial/operator/bookings" className={`${btnSecondary} ${btnSizeSm}`}>
              Log a booking
            </Link>
            <Link href="/vistrial/operator/escalations" className={`${btnSecondary} ${btnSizeSm}`}>
              Raise an escalation
            </Link>
          </>
        }
      />

      <div className="space-y-8">
        {/* On shift */}
        <Panel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-flag-good opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-flag-good" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">On shift</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {activePlacement.shiftStart} – {activePlacement.shiftEnd} client time · term ends{' '}
                  {formatDay(activePlacement.endDate)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">Tier {operator.tier}</Badge>
              <Badge tone="neutral">{formatMoney(operator.baseMonthly)}/mo base</Badge>
              <Badge tone="brand">{formatMoney(activePlacement.commissionPerBooking)} per booking above quota</Badge>
            </div>
          </div>

          <p className="mt-4 border-t border-white/[0.06] pt-3.5 text-[13px] leading-relaxed text-neutral-400">
            <span className="font-medium text-white">Your one job:</span> nobody who reaches out ever gets
            ignored. A qualified booking here means{' '}
            <span className="text-neutral-300">{client.config.qualifiedBookingDefinition.toLowerCase()}</span>
          </p>
        </Panel>

        {missedYesterday && !submittedToday && (
          <Panel className="border-flag-critical/25 bg-flag-critical/[0.06] p-5">
            <Badge tone="critical">Missed EOD</Badge>
            <p className="mt-2.5 text-sm text-white">
              No report was filed for {formatDay(yesterday)}. File it today and say why it was late.
            </p>
            <Link href="/vistrial/operator/eod" className={`${btnPrimary} ${btnSizeSm} mt-3.5`}>
              File the missing report
            </Link>
          </Panel>
        )}

        {/* Standing numbers */}
        <section>
          <SectionHeader title="This period" hint="The numbers your pay and tier are decided on." />
          <StatGrid>
            <StatTile
              label="Response compliance"
              value={formatPercent(metrics.responseComplianceRate)}
              hint={`Inside ${client.config.responseStandardMinutes} minutes · standard is 90%`}
              tone={metrics.responseComplianceRate >= 0.9 ? 'good' : 'critical'}
            />
            <StatTile
              label="Confirmed bookings"
              value={String(metrics.confirmedBookings)}
              hint={`Quota is ${metrics.monthlyQuota} this month`}
              tone={metrics.quotaProgress >= 1 ? 'good' : 'neutral'}
            />
            <StatTile
              label="Pending claims"
              value={String(metrics.pendingBookings)}
              hint="Awaiting review, not yet payable"
              tone={metrics.pendingBookings > 0 ? 'warning' : 'neutral'}
            />
            <StatTile
              label="Days left"
              value={String(metrics.daysRemainingInPeriod)}
              hint="Until the period closes"
            />
          </StatGrid>

          <Panel className="mt-3 p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-white">Quota progress</span>
              <span className="tabular-nums text-neutral-400">
                {metrics.confirmedBookings} of {metrics.monthlyQuota}
              </span>
            </div>
            <Meter
              value={metrics.quotaProgress}
              tone={metrics.quotaProgress >= 1 ? 'good' : metrics.daysRemainingInPeriod <= 7 ? 'warning' : 'brand'}
            />
            <p className="mt-2.5 text-xs leading-relaxed text-neutral-500">
              {aboveQuota > 0
                ? `${aboveQuota} booking${aboveQuota === 1 ? '' : 's'} above quota, worth ${formatMoney(aboveQuota * activePlacement.commissionPerBooking)} in commission when the month closes.`
                : `${metrics.monthlyQuota - metrics.confirmedBookings} more confirmed booking${metrics.monthlyQuota - metrics.confirmedBookings === 1 ? '' : 's'} before commission starts. Quota is monthly, so it settles when the month closes.`}
            </p>
            {metrics.pendingBookings > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-flag-warning">
                {metrics.pendingBookings} claim{metrics.pendingBookings === 1 ? '' : 's'} still pending review.
                Pending bookings are visible to you but do not count toward commission until approved.
              </p>
            )}
          </Panel>
        </section>

        {/* Tasks */}
        {tasks.length > 0 && (
          <section>
            <SectionHeader title="From the admin" hint="Open tasks assigned to you." />
            <ul className="space-y-2.5">
              {tasks.map((task) => (
                <TaskRow key={task.id} taskId={task.id} title={task.title} detail={task.detail} dueOn={task.dueOn} />
              ))}
            </ul>
          </section>
        )}

        {/* Notifications */}
        {notifications.length > 0 && (
          <section>
            <SectionHeader title="Unread notifications" />
            <ul className="space-y-2.5">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Panel className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
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
                      <span className="text-[11px] text-neutral-600">
                        {formatDateTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">{notification.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-400">{notification.body}</p>
                    <MarkRead notificationId={notification.id} />
                  </Panel>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Unanswered escalations */}
        <section>
          <SectionHeader title="Your open escalations" hint="Raised and still waiting on an answer." />
          {myEscalations.length === 0 ? (
            <Panel className="px-5 py-8 text-center text-sm text-neutral-500">
              Nothing waiting on an answer.
            </Panel>
          ) : (
            <ul className="space-y-2.5">
              {myEscalations.map((escalation) => (
                <li key={escalation.id}>
                  <Panel className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone={isEscalationOverdue(escalation, gateway.now) ? 'critical' : 'warning'}>
                        {escalation.category.replace('-', ' ')}
                      </Badge>
                      <span className="text-[11px] text-neutral-600">
                        raised {formatDateTime(escalation.raisedAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-white">{escalation.needed}</p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">{escalation.customerContext}</p>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </section>

        {pending.length > 0 && (
          <Panel className="p-5">
            <SectionHeader title="Bookings you logged that are pending" />
            <ul className="space-y-2">
              {pending.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span className="text-neutral-200">{booking.customerName}</span>
                  <span className="text-xs text-neutral-600">{formatDateTime(booking.scheduledFor)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-neutral-500">
              Nothing is hidden from you: these are counted in your view as pending and will move to confirmed
              if the admin approves them.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  taskId,
  title,
  detail,
  dueOn,
}: {
  taskId: string;
  title: string;
  detail: string;
  dueOn: string | null;
}) {
  const { completeTask } = useOps();
  return (
    <li>
      <Panel className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">{detail}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {dueOn && <Badge tone="neutral">Due {formatDay(dueOn)}</Badge>}
            <button
              type="button"
              onClick={() => completeTask(taskId)}
              className={`${btnSecondary} ${btnSizeSm}`}
            >
              Mark done
            </button>
          </div>
        </div>
      </Panel>
    </li>
  );
}

function MarkRead({ notificationId }: { notificationId: string }) {
  const { readNotification } = useOps();
  return (
    <button
      type="button"
      onClick={() => readNotification(notificationId)}
      className="mt-3 text-xs font-semibold text-brand-300 transition-colors hover:text-brand-200"
    >
      Mark as read
    </button>
  );
}
