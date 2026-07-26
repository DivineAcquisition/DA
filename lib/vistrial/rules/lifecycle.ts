import { daysBetween, toDay } from '../dates';
import type { Operator, OperatorStatus, Placement, PlacementStatus } from '../types';

/** Placements inside this many days of their end date read as expiring. */
export const EXPIRING_WINDOW_DAYS = 30;

const OPERATOR_TRANSITIONS: Record<OperatorStatus, OperatorStatus[]> = {
  applicant: ['in-training', 'inactive'],
  'in-training': ['certified', 'inactive'],
  certified: ['placed', 'on-bench', 'inactive'],
  placed: ['on-bench', 'inactive'],
  'on-bench': ['placed', 'inactive'],
  inactive: ['certified', 'on-bench'],
};

export function canTransitionOperator(from: OperatorStatus, to: OperatorStatus): boolean {
  return OPERATOR_TRANSITIONS[from].includes(to);
}

/**
 * A renewal opens a *new* placement, so `renewed` is terminal on the old one —
 * it exists as a state distinct from `ended` so a natural renewal can be told
 * apart from a lost client at a glance.
 */
const PLACEMENT_TRANSITIONS: Record<Placement['status'], Placement['status'][]> = {
  draft: ['active'],
  active: ['ended', 'renewed'],
  ended: [],
  renewed: [],
};

export function canTransitionPlacement(from: Placement['status'], to: Placement['status']): boolean {
  return PLACEMENT_TRANSITIONS[from].includes(to);
}

/**
 * `expiring` is not stored; it is what an active placement looks like when its
 * end date is inside the window.
 */
export function placementStatus(placement: Placement, now: string): PlacementStatus {
  if (placement.status !== 'active') return placement.status;
  const remaining = daysBetween(toDay(now), placement.endDate);
  return remaining <= EXPIRING_WINDOW_DAYS ? 'expiring' : 'active';
}

export function daysUntilEnd(placement: Placement, now: string): number {
  return daysBetween(toDay(now), placement.endDate);
}

export function isPlacementLive(placement: Placement): boolean {
  return placement.status === 'active';
}

/**
 * Ending a placement closes it and drops the operator onto the bench, so the
 * admin can see who is available without going hunting. The case file and its
 * logs stay attached to the client, not to the departed operator.
 */
export function endPlacement(
  placement: Placement,
  operator: Operator,
  closedOn: string,
): { placement: Placement; operator: Operator; movedToBench: boolean } {
  const closed: Placement = { ...placement, status: 'ended', closedOn: toDay(closedOn) };
  const movedToBench = operator.status === 'placed';

  return {
    placement: closed,
    operator: movedToBench ? { ...operator, status: 'on-bench' } : operator,
    movedToBench,
  };
}

export const OPERATOR_STATUS_LABELS: Record<OperatorStatus, string> = {
  applicant: 'Applicant',
  'in-training': 'In training',
  certified: 'Certified',
  placed: 'Placed',
  'on-bench': 'On bench',
  inactive: 'Inactive',
};

export const PLACEMENT_STATUS_LABELS: Record<PlacementStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  expiring: 'Expiring',
  ended: 'Ended',
  renewed: 'Renewed',
};
