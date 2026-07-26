import { daysInMonth, monthEnd, monthKey, monthStart, overlapDays, toDay } from '../dates';
import type {
  Booking,
  Operator,
  OperatorTier,
  PayAdjustment,
  PayPeriod,
  PayStatement,
  Placement,
  ResponseDay,
} from '../types';
import { isCommissionable } from './bookings';

/**
 * Pay computation. The system works out what is owed and produces a statement;
 * it does not move money.
 */

/** Monthly speed bonus by tier, awarded only if the standard held all month. */
export const SPEED_BONUS_BY_TIER: Record<OperatorTier, number> = { 1: 40, 2: 60, 3: 90 };

/** Share of conversations that must land inside the standard to hold it. */
export const RESPONSE_STANDARD_THRESHOLD = 0.9;

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

export type BaseResult = { amount: number; activeDays: number; monthDays: number; detail: string };

/**
 * Base is prorated over the calendar month rather than the half-month, so the
 * two periods of a fully worked month always sum to exactly the monthly base.
 */
export function computeBase(operator: Operator, placement: Placement, period: PayPeriod): BaseResult {
  const placementEnd = placement.closedOn ?? placement.endDate;
  const activeDays = overlapDays(placement.startDate, placementEnd, period.start, period.end);
  const monthDays = daysInMonth(period.start);
  const amount = round2((operator.baseMonthly * activeDays) / monthDays);

  return {
    amount,
    activeDays,
    monthDays,
    detail:
      activeDays === 0
        ? 'Placement was not active during this period.'
        : `Tier ${operator.tier} base of $${operator.baseMonthly}/mo prorated over ${activeDays} active day${activeDays === 1 ? '' : 's'} of ${monthDays}.`,
  };
}

// ---------------------------------------------------------------------------
// Commission
// ---------------------------------------------------------------------------

export type CommissionResult = {
  amount: number;
  /** Bookings above quota, which are the ones that actually paid. */
  payableBookingIds: string[];
  monthlyCredited: number;
  quota: number;
  aboveQuota: number;
  settlesThisPeriod: boolean;
  detail: string;
};

/**
 * Quota is monthly but periods are semi-monthly, so commission accrues against
 * the running monthly total and settles on the period that closes the month.
 * The mid-month statement therefore shows progress and a zero, on purpose.
 */
export function computeCommission(
  placement: Placement,
  period: PayPeriod,
  bookingsForPlacement: Booking[],
): CommissionResult {
  const month = monthKey(period.start);
  const credited = bookingsForPlacement
    .filter((booking) => isCommissionable(booking))
    .filter((booking) => monthKey(toDay(booking.scheduledFor)) === month)
    // Earliest first, so the bookings that clear quota are the earliest ones and
    // the payable set is stable as more bookings arrive.
    .sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor));

  const quota = placement.monthlyBookingQuota;
  const payable = credited.slice(quota);
  const aboveQuota = payable.length;
  const settles = period.closesMonth;
  const amount = settles ? round2(aboveQuota * placement.commissionPerBooking) : 0;

  const monthLabel = `${monthStart(period.start)} to ${monthEnd(period.start)}`;

  return {
    amount,
    payableBookingIds: settles ? payable.map((booking) => booking.id) : [],
    monthlyCredited: credited.length,
    quota,
    aboveQuota,
    settlesThisPeriod: settles,
    detail: settles
      ? `${credited.length} confirmed booking${credited.length === 1 ? '' : 's'} for ${monthLabel} against a quota of ${quota}. ${aboveQuota} above quota at $${placement.commissionPerBooking} each.`
      : `Quota is monthly, so commission settles on the period that closes the month. ${credited.length} of ${quota} confirmed so far for ${monthLabel}; nothing is payable yet.`,
  };
}

// ---------------------------------------------------------------------------
// Speed bonus
// ---------------------------------------------------------------------------

export type SpeedBonusResult = { amount: number; awarded: boolean; complianceRate: number; detail: string };

/**
 * Monthly, and all-or-nothing: the operator either held the response standard
 * across the whole month or did not. Settles with the month-closing period.
 */
export function computeSpeedBonus(
  operator: Operator,
  placement: Placement,
  period: PayPeriod,
  responseDays: ResponseDay[],
): SpeedBonusResult {
  const month = monthKey(period.start);
  const relevant = responseDays.filter(
    (day) => day.placementId === placement.id && monthKey(day.date) === month,
  );

  const conversations = relevant.reduce((sum, day) => sum + day.conversations, 0);
  const withinStandard = relevant.reduce((sum, day) => sum + day.withinStandard, 0);
  const complianceRate = conversations === 0 ? 0 : withinStandard / conversations;

  if (!period.closesMonth) {
    return {
      amount: 0,
      awarded: false,
      complianceRate,
      detail: 'Speed bonus is monthly and settles on the period that closes the month.',
    };
  }

  if (conversations === 0) {
    return {
      amount: 0,
      awarded: false,
      complianceRate,
      detail: 'No tracked conversations this month, so no speed bonus.',
    };
  }

  const awarded = complianceRate >= RESPONSE_STANDARD_THRESHOLD;

  return {
    amount: awarded ? SPEED_BONUS_BY_TIER[operator.tier] : 0,
    awarded,
    complianceRate,
    detail: awarded
      ? `Held the ${Math.round(RESPONSE_STANDARD_THRESHOLD * 100)}% response standard all month at ${formatRate(complianceRate)}.`
      : `Response compliance of ${formatRate(complianceRate)} is below the ${Math.round(RESPONSE_STANDARD_THRESHOLD * 100)}% standard, so the bonus is not awarded.`,
  };
}

// ---------------------------------------------------------------------------
// Statement
// ---------------------------------------------------------------------------

export type StatementInput = {
  operator: Operator;
  placement: Placement;
  period: PayPeriod;
  bookingsForPlacement: Booking[];
  responseDays: ResponseDay[];
  adjustments?: PayAdjustment[];
  existing?: PayStatement;
};

export function computeStatement({
  operator,
  placement,
  period,
  bookingsForPlacement,
  responseDays,
  adjustments = [],
  existing,
}: StatementInput): PayStatement {
  // Rule 6: a closed statement is an immutable record and is never recomputed.
  if (existing?.locked) return existing;

  const base = computeBase(operator, placement, period);
  const commission = computeCommission(placement, period, bookingsForPlacement);
  const speedBonus = computeSpeedBonus(operator, placement, period, responseDays);
  const adjustmentTotal = adjustments.reduce((sum, item) => sum + item.amount, 0);

  return {
    id: existing?.id ?? `stmt-${placement.id}-${period.id}`,
    operatorId: operator.id,
    placementId: placement.id,
    periodId: period.id,
    baseAmount: base.amount,
    baseDetail: base.detail,
    commissionAmount: commission.amount,
    commissionDetail: commission.detail,
    commissionBookingIds: commission.payableBookingIds,
    speedBonusAmount: speedBonus.amount,
    speedBonusDetail: speedBonus.detail,
    adjustments,
    total: round2(base.amount + commission.amount + speedBonus.amount + adjustmentTotal),
    locked: false,
    lockedAt: null,
  };
}

export function statementLines(statement: PayStatement): { label: string; detail: string; amount: number }[] {
  return [
    { label: 'Base', detail: statement.baseDetail, amount: statement.baseAmount },
    { label: 'Commission', detail: statement.commissionDetail, amount: statement.commissionAmount },
    { label: 'Speed bonus', detail: statement.speedBonusDetail, amount: statement.speedBonusAmount },
    ...statement.adjustments.map((adjustment) => ({
      label: adjustment.label,
      detail: `${adjustment.reason} — added by ${adjustment.addedBy}`,
      amount: adjustment.amount,
    })),
  ];
}

/** Closing a period locks its statements. After this they do not change. */
export function lockStatement(statement: PayStatement, at: string): PayStatement {
  if (statement.locked) return statement;
  return { ...statement, locked: true, lockedAt: at };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const formatRate = (rate: number) => `${Math.round(rate * 1000) / 10}%`;
