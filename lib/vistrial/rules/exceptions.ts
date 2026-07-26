import { addDays, hoursBetween, toDay } from '../dates';
import type {
  Booking,
  Client,
  EodReport,
  Escalation,
  Exception,
  ExceptionKind,
  Operator,
  Placement,
  ResponseDay,
} from '../types';
import { pendingBookings } from './bookings';
import { currentVersions } from './eod';
import { daysUntilEnd, EXPIRING_WINDOW_DAYS, isPlacementLive } from './lifecycle';
import {
  isBelowResponseStandard,
  isEscalationOverdue,
  placementMetrics,
  responseCompliance,
  formatRate,
} from './metrics';

/**
 * The admin landing view answers one question: where do I need to look today.
 * Ranking is fixed by kind so the queue order never drifts between sessions.
 */
export const EXCEPTION_RANK: Record<ExceptionKind, number> = {
  'escalation-overdue': 1,
  'response-below-standard': 2,
  'missed-eod': 3,
  'booking-review': 4,
  'quota-at-risk': 5,
  'placement-expiring': 6,
};

export const EXCEPTION_KIND_LABELS: Record<ExceptionKind, string> = {
  'escalation-overdue': 'Escalation overdue',
  'response-below-standard': 'Below response standard',
  'missed-eod': 'Missed EOD',
  'booking-review': 'Booking claim to review',
  'quota-at-risk': 'Quota at risk',
  'placement-expiring': 'Placement expiring',
};

export type ExceptionInput = {
  operators: Operator[];
  clients: Client[];
  placements: Placement[];
  bookings: Booking[];
  eodReports: EodReport[];
  escalations: Escalation[];
  responseDays: ResponseDay[];
  now: string;
};

export function buildExceptionQueue(input: ExceptionInput): Exception[] {
  const { operators, clients, placements, bookings, eodReports, escalations, responseDays, now } = input;
  const today = toDay(now);
  const yesterday = addDays(today, -1);

  const operatorName = (id: string) => operators.find((o) => o.id === id)?.name ?? 'Unknown operator';
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Unknown client';
  const livePlacements = placements.filter(isPlacementLive);

  const out: Exception[] = [];

  // 1. Escalations open past their response window. An unanswered escalation is
  //    a customer waiting, which is why it outranks everything else.
  for (const escalation of escalations) {
    if (!isEscalationOverdue(escalation, now)) continue;
    const overdueBy = Math.floor(hoursBetween(escalation.responseDueAt, now));
    out.push({
      id: `exc-escalation-${escalation.id}`,
      kind: 'escalation-overdue',
      severity: 'critical',
      title: `${clientName(escalation.clientId)} — escalation unanswered for ${overdueBy}h`,
      detail: escalation.needed,
      operatorId: escalation.operatorId,
      clientId: escalation.clientId,
      placementId: escalation.placementId,
      href: `/vistrial/admin/escalations#${escalation.id}`,
      rank: EXCEPTION_RANK['escalation-overdue'],
    });
  }

  // 2. Operators on shift today who are below the response standard today.
  for (const placement of livePlacements) {
    const rate = responseCompliance(responseDays, placement.id, today, today);
    if (!isBelowResponseStandard(rate)) continue;
    out.push({
      id: `exc-response-${placement.id}`,
      kind: 'response-below-standard',
      severity: 'critical',
      title: `${operatorName(placement.operatorId)} is at ${formatRate(rate)} response compliance today`,
      detail: `On shift for ${clientName(placement.clientId)}. Standard is 90% inside the response window.`,
      operatorId: placement.operatorId,
      clientId: placement.clientId,
      placementId: placement.id,
      href: `/vistrial/admin/operators/${placement.operatorId}`,
      rank: EXCEPTION_RANK['response-below-standard'],
    });
  }

  // 3. EODs missed yesterday.
  const submittedYesterday = new Set(
    currentVersions(eodReports)
      .filter((report) => report.shiftDate === yesterday)
      .map((report) => report.placementId),
  );
  for (const placement of livePlacements) {
    if (submittedYesterday.has(placement.id)) continue;
    if (Date.parse(placement.startDate) > Date.parse(yesterday)) continue;
    out.push({
      id: `exc-eod-${placement.id}-${yesterday}`,
      kind: 'missed-eod',
      severity: 'critical',
      title: `${operatorName(placement.operatorId)} did not submit an EOD for ${yesterday}`,
      detail: `${clientName(placement.clientId)} placement. Submission rate is the earliest signal a placement is slipping.`,
      operatorId: placement.operatorId,
      clientId: placement.clientId,
      placementId: placement.id,
      href: `/vistrial/admin/clients/${placement.clientId}`,
      rank: EXCEPTION_RANK['missed-eod'],
    });
  }

  // 4. Booking claims awaiting review. Grouped per placement so one operator
  //    logging five unmatched bookings is one row, not five.
  const pending = pendingBookings(bookings);
  const pendingByPlacement = new Map<string, Booking[]>();
  for (const booking of pending) {
    const bucket = pendingByPlacement.get(booking.placementId) ?? [];
    bucket.push(booking);
    pendingByPlacement.set(booking.placementId, bucket);
  }
  for (const [placementId, claims] of pendingByPlacement) {
    const placement = placements.find((candidate) => candidate.id === placementId);
    if (!placement) continue;
    out.push({
      id: `exc-review-${placementId}`,
      kind: 'booking-review',
      severity: 'warning',
      title: `${claims.length} booking claim${claims.length === 1 ? '' : 's'} from ${operatorName(placement.operatorId)} awaiting review`,
      detail: `Logged manually with no matching GoHighLevel event. Nothing pays until approved.`,
      operatorId: placement.operatorId,
      clientId: placement.clientId,
      placementId,
      href: '/vistrial/admin/bookings',
      rank: EXCEPTION_RANK['booking-review'],
    });
  }

  // 5. Behind quota with under a week left in the period.
  for (const placement of livePlacements) {
    const metrics = placementMetrics({
      placement,
      bookings,
      reports: eodReports,
      escalations,
      responseDays,
      now,
    });
    if (metrics.quotaProgress >= 1 || metrics.daysRemainingInPeriod > 7) continue;
    const short = metrics.monthlyQuota - metrics.confirmedBookings;
    out.push({
      id: `exc-quota-${placement.id}`,
      kind: 'quota-at-risk',
      severity: 'warning',
      title: `${operatorName(placement.operatorId)} is ${short} booking${short === 1 ? '' : 's'} short with ${metrics.daysRemainingInPeriod} day${metrics.daysRemainingInPeriod === 1 ? '' : 's'} left`,
      detail: `${metrics.confirmedBookings} of ${metrics.monthlyQuota} confirmed for ${clientName(placement.clientId)}.`,
      operatorId: placement.operatorId,
      clientId: placement.clientId,
      placementId: placement.id,
      href: `/vistrial/admin/operators/${placement.operatorId}`,
      rank: EXCEPTION_RANK['quota-at-risk'],
    });
  }

  // 6. Placements expiring inside the window.
  for (const placement of livePlacements) {
    const remaining = daysUntilEnd(placement, now);
    if (remaining < 0 || remaining > EXPIRING_WINDOW_DAYS) continue;
    out.push({
      id: `exc-expiring-${placement.id}`,
      kind: 'placement-expiring',
      severity: 'warning',
      title: `${clientName(placement.clientId)} placement ends in ${remaining} day${remaining === 1 ? '' : 's'}`,
      detail: `${operatorName(placement.operatorId)} moves to the bench on ${placement.endDate} unless the term is renewed.`,
      operatorId: placement.operatorId,
      clientId: placement.clientId,
      placementId: placement.id,
      href: `/vistrial/admin/clients/${placement.clientId}`,
      rank: EXCEPTION_RANK['placement-expiring'],
    });
  }

  return out.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
}
