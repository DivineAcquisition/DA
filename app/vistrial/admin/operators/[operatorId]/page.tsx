'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { formatDateTime, formatDay, formatMoney, formatPercent } from '@/lib/vistrial/format';
import { summarise } from '@/lib/vistrial/rules/bookings';
import { OPERATOR_STATUS_LABELS, PLACEMENT_STATUS_LABELS } from '@/lib/vistrial/rules/lifecycle';
import { CHANNEL_LABELS, SEVERITY_LABELS } from '@/lib/vistrial/rules/notifications';
import { useOps } from '@/lib/vistrial/store';
import type { NotificationSeverity } from '@/lib/vistrial/types';
import { AdminOnly } from '../../../components/AppShell';
import {
  Avatar,
  Badge,
  EmptyState,
  Meter,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
  inputClass,
  labelClass,
  selectClass,
} from '../../../components/ui';

export default function OperatorProfilePage() {
  return (
    <AdminOnly>
      <Profile />
    </AdminOnly>
  );
}

function Profile() {
  const params = useParams();
  const operatorId = params.operatorId as string;
  const { gateway, sendMessage, endPlacementNow } = useOps();

  const operator = gateway.operator(operatorId);
  if (!operator) {
    return (
      <EmptyState
        title="Operator not found"
        action={
          <Link href="/vistrial/admin/operators" className={`${btnSecondary} ${btnSizeSm}`}>
            Back to roster
          </Link>
        }
      />
    );
  }

  const placements = gateway
    .placementsForOperator(operatorId)
    .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  const live = placements.find((placement) => placement.status === 'active');
  const allBookings = placements.flatMap((placement) => gateway.bookingsFor(placement.id));
  const reconciliation = summarise(allBookings);
  const rejected = allBookings.filter((booking) => booking.state === 'rejected');
  const statements = gateway
    .statementsFor(operatorId)
    .sort((a, b) => (a.periodId < b.periodId ? 1 : -1));
  const escalations = placements.flatMap((placement) => gateway.escalationsFor(placement.id));
  const notifications = gateway.notificationsFor(operatorId);
  const metrics = live ? gateway.metricsFor(live.id) : null;

  const lifetimePay = statements.reduce((sum, statement) => sum + statement.total, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operator record"
        title={operator.name}
        description={`Performance across every placement held. This is the record behind tier increases and re-placement decisions.`}
        actions={
          live && (
            <button
              type="button"
              onClick={() => endPlacementNow(live.id)}
              className={`${btnSecondary} ${btnSizeSm}`}
            >
              End placement
            </button>
          )
        }
      />

      <Panel className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={operator.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={operator.status === 'placed' ? 'good' : operator.status === 'on-bench' ? 'warning' : 'neutral'}>
                {OPERATOR_STATUS_LABELS[operator.status]}
              </Badge>
              <Badge tone="brand">Tier {operator.tier}</Badge>
              <Badge tone="neutral">{formatMoney(operator.baseMonthly)}/mo base</Badge>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {operator.country} · {operator.timeZone} · joined {formatDay(operator.joinedOn)}
              {operator.certifiedOn ? ` · certified ${formatDay(operator.certifiedOn)}` : ' · not yet certified'}
            </p>
          </div>
        </div>
      </Panel>

      {metrics && live ? (
        <>
          <StatGrid>
            <StatTile
              label="Response compliance"
              value={formatPercent(metrics.responseComplianceRate)}
              hint="This month, inside the window"
              tone={metrics.responseComplianceRate >= 0.9 ? 'good' : 'critical'}
            />
            <StatTile
              label="EOD submission"
              value={formatPercent(metrics.eodSubmissionRate)}
              hint={metrics.missedEodDates.length > 0 ? `${metrics.missedEodDates.length} missed` : 'No gaps'}
              tone={metrics.eodSubmissionRate >= 0.95 ? 'good' : 'warning'}
            />
            <StatTile
              label="Confirmed bookings"
              value={`${metrics.confirmedBookings}/${metrics.monthlyQuota}`}
              hint={`${metrics.daysRemainingInPeriod} days left in the period`}
              tone={metrics.quotaProgress >= 1 ? 'good' : 'warning'}
            />
            <StatTile
              label="Pending claims"
              value={String(metrics.pendingBookings)}
              hint="Not payable until approved"
              tone={metrics.pendingBookings > 0 ? 'warning' : 'neutral'}
            />
          </StatGrid>

          <Panel className="p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
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
              Commission starts on confirmed booking {metrics.monthlyQuota + 1} at{' '}
              {formatMoney(live.commissionPerBooking)} each, settled when the month closes.
            </p>
          </Panel>
        </>
      ) : (
        <EmptyState
          title={`${operator.name} has no live placement`}
          detail={
            operator.status === 'on-bench'
              ? 'Certified and available. History below carries over to the next placement.'
              : 'Still working through certification.'
          }
        />
      )}

      {/* Reconciliation quality */}
      <section>
        <SectionHeader
          title="Booking reconciliation"
          hint="Across every placement. A pattern of rejected claims is a serious signal."
        />
        <StatGrid columns={4}>
          <StatTile label="Confirmed" value={String(reconciliation.confirmed)} tone="good" />
          <StatTile
            label="System only"
            value={String(reconciliation.systemOnly)}
            hint={`${formatPercent(reconciliation.unloggedRate)} never logged`}
          />
          <StatTile
            label="Pending"
            value={String(reconciliation.pendingReview)}
            tone={reconciliation.pendingReview > 0 ? 'warning' : 'neutral'}
          />
          <StatTile
            label="Rejected"
            value={String(reconciliation.rejected)}
            tone={reconciliation.rejected > 0 ? 'critical' : 'neutral'}
          />
        </StatGrid>

        {rejected.length > 0 && (
          <ul className="mt-3 space-y-2">
            {rejected.map((booking) => (
              <li key={booking.id}>
                <Panel className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{booking.customerName}</p>
                    <span className="text-[11px] text-neutral-600">
                      {booking.reviewedAt ? formatDateTime(booking.reviewedAt) : ''}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-flag-critical/90">
                    {booking.rejectionReason}
                  </p>
                  {booking.operatorNote && (
                    <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
                      Operator note: {booking.operatorNote}
                    </p>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Placement history */}
      <section>
        <SectionHeader title="Placement history" hint="History follows the person, not the client." />
        <ul className="space-y-2.5">
          {placements.map((placement) => {
            const status = gateway.statusOf(placement);
            const confirmed = gateway.confirmedFor(placement.id).length;
            const reports = gateway.currentReportsFor(placement.id).length;
            return (
              <li key={placement.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/vistrial/admin/clients/${placement.clientId}`}
                          className="text-sm font-semibold text-white hover:text-brand-200"
                        >
                          {gateway.clientName(placement.clientId)}
                        </Link>
                        <Badge
                          tone={
                            status === 'active'
                              ? 'good'
                              : status === 'expiring'
                                ? 'warning'
                                : status === 'renewed'
                                  ? 'brand'
                                  : 'neutral'
                          }
                        >
                          {PLACEMENT_STATUS_LABELS[status]}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-neutral-500">
                        {formatDay(placement.startDate)} – {formatDay(placement.closedOn ?? placement.endDate)}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-neutral-500">
                      {confirmed} confirmed · {reports} reports
                    </p>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Escalation quality */}
      <section>
        <SectionHeader
          title="Escalation quality"
          hint="Raising rather than improvising is the behaviour we want."
        />
        {escalations.length === 0 ? (
          <EmptyState title="No escalations raised" />
        ) : (
          <ul className="space-y-2">
            {escalations
              .sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt))
              .map((escalation) => (
                <li key={escalation.id}>
                  <Panel className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge
                        tone={
                          escalation.status === 'open'
                            ? 'warning'
                            : escalation.status === 'answered'
                              ? 'brand'
                              : 'neutral'
                        }
                      >
                        {escalation.category.replace('-', ' ')} · {escalation.status}
                      </Badge>
                      <span className="text-[11px] text-neutral-600">{formatDateTime(escalation.raisedAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-neutral-200">{escalation.needed}</p>
                  </Panel>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* Pay history */}
      <section>
        <SectionHeader title="Pay history" hint={`${formatMoney(lifetimePay)} across ${statements.length} statements.`} />
        <Panel className="divide-y divide-white/[0.05] px-5">
          {statements.map((statement) => {
            const period = gateway.payPeriod(statement.periodId);
            return (
              <div key={statement.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {period ? `${formatDay(period.start)} – ${formatDay(period.end)}` : statement.periodId}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {gateway.clientName(gateway.placement(statement.placementId)?.clientId ?? '')} ·{' '}
                    {formatMoney(statement.baseAmount)} base
                    {statement.commissionAmount > 0 && ` · ${formatMoney(statement.commissionAmount)} commission`}
                    {statement.speedBonusAmount > 0 && ` · ${formatMoney(statement.speedBonusAmount)} speed bonus`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={statement.locked ? 'neutral' : 'brand'}>
                    {statement.locked ? 'Locked' : 'Open'}
                  </Badge>
                  <span className="text-sm font-semibold tabular-nums text-white">
                    {formatMoney(statement.total)}
                  </span>
                </div>
              </div>
            );
          })}
        </Panel>
      </section>

      {/* Direct message */}
      <DirectMessage operatorId={operatorId} onSend={sendMessage} preferred={operator.preferredChannel} />

      {/* Notification log */}
      <section>
        <SectionHeader
          title="Notifications sent"
          hint="Whether the operator actually received a message, which matters when a placement is going wrong."
        />
        {notifications.length === 0 ? (
          <EmptyState title="Nothing sent yet" />
        ) : (
          <ul className="space-y-2">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <Panel className="px-5 py-3.5">
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
                    <span className="text-[11px] text-neutral-600">{formatDateTime(notification.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-white">{notification.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">{notification.body}</p>
                  <ul className="mt-2.5 flex flex-wrap gap-1.5">
                    {notification.attempts.map((attempt) => (
                      <li key={attempt.channel}>
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
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DirectMessage({
  operatorId,
  onSend,
  preferred,
}: {
  operatorId: string;
  onSend: (operatorId: string, severity: NotificationSeverity, title: string, body: string) => void;
  preferred: string;
}) {
  const [severity, setSeverity] = useState<NotificationSeverity>('informational');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const routing = {
    informational: 'In-app and Discord.',
    important: 'In-app, Discord and email.',
    urgent: 'All four channels including WhatsApp, ignoring channel preference.',
  }[severity];

  return (
    <section>
      <SectionHeader title="Send a direct message" hint={`Preferred channel: ${preferred}.`} />
      <Panel className="p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="dm-severity">
              Severity
            </label>
            <select
              id="dm-severity"
              value={severity}
              onChange={(event) => setSeverity(event.target.value as NotificationSeverity)}
              className={selectClass}
            >
              <option value="informational">Informational</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="dm-title">
              Subject
            </label>
            <input
              id="dm-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass}
              placeholder="Check-in on the afternoon block"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass} htmlFor="dm-body">
            Message
          </label>
          <textarea
            id="dm-body"
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">Routes to: {routing}</p>
          <button
            type="button"
            disabled={!title.trim() || !body.trim()}
            onClick={() => {
              onSend(operatorId, severity, title.trim(), body.trim());
              setTitle('');
              setBody('');
            }}
            className={`${btnPrimary} ${btnSizeSm}`}
          >
            Send
          </button>
        </div>
      </Panel>
    </section>
  );
}
