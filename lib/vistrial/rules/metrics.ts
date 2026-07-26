import { addDays, daysBetween, eachDay, isWithin, monthKey, monthEnd, toDay } from '../dates';
import type {
  Booking,
  EodReport,
  Escalation,
  Placement,
  PlacementMetrics,
  ResponseDay,
} from '../types';
import { commissionableBookings, pendingBookings } from './bookings';
import { currentVersions } from './eod';
import { RESPONSE_STANDARD_THRESHOLD } from './pay';

/**
 * Standing metrics. EOD submission rate is deliberately prominent: operators
 * stop submitting EODs before they stop performing, so it leads the decline.
 */

export function responseCompliance(
  responseDays: ResponseDay[],
  placementId: string,
  from: string,
  to: string,
): number {
  const relevant = responseDays.filter(
    (day) => day.placementId === placementId && isWithin(day.date, from, to),
  );
  const conversations = relevant.reduce((sum, day) => sum + day.conversations, 0);
  if (conversations === 0) return 0;
  const within = relevant.reduce((sum, day) => sum + day.withinStandard, 0);
  return within / conversations;
}

export function isBelowResponseStandard(rate: number): boolean {
  return rate > 0 && rate < RESPONSE_STANDARD_THRESHOLD;
}

/**
 * Shift days the operator owed a report for, bounded by the placement window and
 * excluding the current day, which is not yet late.
 */
export function expectedShiftDays(placement: Placement, from: string, to: string): string[] {
  const placementEnd = placement.closedOn ?? placement.endDate;
  const start = Date.parse(from) > Date.parse(placement.startDate) ? toDay(from) : placement.startDate;
  const end = Date.parse(to) < Date.parse(placementEnd) ? toDay(to) : placementEnd;
  if (Date.parse(end) < Date.parse(start)) return [];
  return eachDay(start, end);
}

export function missedEodDates(
  reports: EodReport[],
  placement: Placement,
  from: string,
  to: string,
): string[] {
  const submitted = new Set(
    currentVersions(reports)
      .filter((report) => report.placementId === placement.id)
      .map((report) => report.shiftDate),
  );
  return expectedShiftDays(placement, from, to).filter((day) => !submitted.has(day));
}

export function eodSubmissionRate(
  reports: EodReport[],
  placement: Placement,
  from: string,
  to: string,
): number {
  const expected = expectedShiftDays(placement, from, to);
  if (expected.length === 0) return 1;
  const missed = missedEodDates(reports, placement, from, to).length;
  return (expected.length - missed) / expected.length;
}

export function isEscalationOverdue(escalation: Escalation, now: string): boolean {
  return escalation.status === 'open' && Date.parse(escalation.responseDueAt) < Date.parse(now);
}

export type MetricsInput = {
  placement: Placement;
  bookings: Booking[];
  reports: EodReport[];
  escalations: Escalation[];
  responseDays: ResponseDay[];
  now: string;
};

/** Rolls the current month's numbers up for one placement. */
export function placementMetrics({
  placement,
  bookings,
  reports,
  escalations,
  responseDays,
  now,
}: MetricsInput): PlacementMetrics {
  const today = toDay(now);
  const month = monthKey(today);
  const periodStart = `${month}-01`;
  const periodEnd = monthEnd(today);

  const placementBookings = bookings.filter(
    (booking) => booking.placementId === placement.id && monthKey(toDay(booking.scheduledFor)) === month,
  );
  const placementEscalations = escalations.filter(
    (escalation) => escalation.placementId === placement.id,
  );

  const confirmed = commissionableBookings(placementBookings).length;
  // Yesterday is the last day a report could be late; today's is not due yet.
  const eodWindowEnd = addDays(today, -1);

  return {
    placementId: placement.id,
    responseComplianceRate: responseCompliance(responseDays, placement.id, periodStart, today),
    conversationsHandled: responseDays
      .filter((day) => day.placementId === placement.id && isWithin(day.date, periodStart, today))
      .reduce((sum, day) => sum + day.conversations, 0),
    confirmedBookings: confirmed,
    pendingBookings: pendingBookings(placementBookings).length,
    monthlyQuota: placement.monthlyBookingQuota,
    quotaProgress: placement.monthlyBookingQuota === 0 ? 1 : confirmed / placement.monthlyBookingQuota,
    daysRemainingInPeriod: Math.max(0, daysBetween(today, periodEnd)),
    eodSubmissionRate: eodSubmissionRate(reports, placement, periodStart, eodWindowEnd),
    missedEodDates: missedEodDates(reports, placement, periodStart, eodWindowEnd),
    openEscalations: placementEscalations.filter((escalation) => escalation.status === 'open').length,
    overdueEscalations: placementEscalations.filter((escalation) => isEscalationOverdue(escalation, now))
      .length,
  };
}

/** Quota is at risk when the operator is short with under a week left. */
export function isQuotaAtRisk(metrics: PlacementMetrics): boolean {
  return metrics.quotaProgress < 1 && metrics.daysRemainingInPeriod <= 7;
}

export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
