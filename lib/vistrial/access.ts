import type { Actor, OpsData, Placement } from './types';

/**
 * Rule 1: operators see only their own placements and their own data, and the
 * check lives here rather than in the UI. Every read in `gateway.ts` routes
 * through these guards, so a component that forgets to filter still cannot leak
 * another operator's records.
 */
export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

export const isAdmin = (actor: Actor) => actor.role === 'admin';

export function assertAdmin(actor: Actor, what: string): void {
  if (!isAdmin(actor)) {
    throw new AccessDeniedError(`${actor.role} may not read ${what}`);
  }
}

/** Placements an actor is allowed to see at all. */
export function visiblePlacements(actor: Actor, data: OpsData): Placement[] {
  if (isAdmin(actor)) return data.placements;
  return data.placements.filter((placement) => placement.operatorId === actor.id);
}

export function visiblePlacementIds(actor: Actor, data: OpsData): Set<string> {
  return new Set(visiblePlacements(actor, data).map((placement) => placement.id));
}

export function canReadPlacement(actor: Actor, placementId: string, data: OpsData): boolean {
  if (isAdmin(actor)) return true;
  const placement = data.placements.find((candidate) => candidate.id === placementId);
  return Boolean(placement && placement.operatorId === actor.id);
}

export function assertCanReadPlacement(actor: Actor, placementId: string, data: OpsData): void {
  if (!canReadPlacement(actor, placementId, data)) {
    throw new AccessDeniedError(`operator ${actor.id} may not read placement ${placementId}`);
  }
}

export function canReadOperator(actor: Actor, operatorId: string): boolean {
  return isAdmin(actor) || actor.id === operatorId;
}

export function assertCanReadOperator(actor: Actor, operatorId: string): void {
  if (!canReadOperator(actor, operatorId)) {
    throw new AccessDeniedError(`operator ${actor.id} may not read operator ${operatorId}`);
  }
}

/**
 * Filters an arbitrary collection of placement-scoped records. Anything with a
 * `placementId` can be narrowed with this.
 */
export function scopeByPlacement<T extends { placementId: string }>(
  actor: Actor,
  records: T[],
  data: OpsData,
): T[] {
  if (isAdmin(actor)) return records;
  const allowed = visiblePlacementIds(actor, data);
  return records.filter((record) => allowed.has(record.placementId));
}

export function scopeByOperator<T extends { operatorId: string }>(actor: Actor, records: T[]): T[] {
  if (isAdmin(actor)) return records;
  return records.filter((record) => record.operatorId === actor.id);
}

/**
 * Commercial fields an operator must never see: what DA charges the client, the
 * contract, and the margin. The hub simply does not expose them to operators,
 * so this is the list of keys that stay admin-only when a client record is read.
 */
export const ADMIN_ONLY_CLIENT_FIELDS = ['contractValue', 'margin', 'retainer'] as const;
