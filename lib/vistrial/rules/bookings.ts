import type { Booking, BookingState } from '../types';

/**
 * Booking reconciliation.
 *
 * GoHighLevel ingestion is the source of truth. The operator's manual log is a
 * fallback for bookings taken outside the tracked path — over the phone, or when
 * the webhook failed. The two are reconciled rather than summed, because summing
 * would pay twice for one appointment.
 */

/** How far apart a manual entry and an ingested event may sit and still match. */
export const MATCH_WINDOW_MINUTES = 120;

const digitsOnly = (value: string | null) => (value ? value.replace(/\D/g, '') : '');

const normaliseEmail = (value: string | null) => (value ? value.trim().toLowerCase() : '');

const normaliseName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const minutesApart = (a: string, b: string) =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000;

/**
 * Two records describe the same appointment when they sit on the same placement,
 * inside the match window, and share a customer identifier. Phone and email are
 * strong identifiers; name alone is accepted only as a last resort, because
 * common names would otherwise collide.
 */
export function isSameAppointment(manual: Booking, ingested: Booking): boolean {
  if (manual.placementId !== ingested.placementId) return false;
  if (minutesApart(manual.scheduledFor, ingested.scheduledFor) > MATCH_WINDOW_MINUTES) return false;

  const manualPhone = digitsOnly(manual.customerPhone);
  const ingestedPhone = digitsOnly(ingested.customerPhone);
  if (manualPhone && ingestedPhone) {
    // Compare the last 10 digits so country-code formatting differences match.
    return manualPhone.slice(-10) === ingestedPhone.slice(-10);
  }

  const manualEmail = normaliseEmail(manual.customerEmail);
  const ingestedEmail = normaliseEmail(ingested.customerEmail);
  if (manualEmail && ingestedEmail) {
    return manualEmail === ingestedEmail;
  }

  return normaliseName(manual.customerName) === normaliseName(ingested.customerName);
}

export type ReconcileResult = {
  /** The manual entry's resolved state. */
  state: Extract<BookingState, 'confirmed' | 'pending-review'>;
  /** The ingested booking it matched, if any. */
  matchedBookingId: string | null;
};

/**
 * Resolves a single manual entry against the ingested set.
 *
 * A match means both sources agree, so the entry is confirmed. No match means
 * the operator is claiming a booking the system never saw, which is visible and
 * counted as pending but pays nothing until an admin approves it.
 */
export function reconcileManualEntry(manual: Booking, ingested: Booking[]): ReconcileResult {
  const alreadyClaimed = new Set(
    ingested.map((booking) => booking.matchedBookingId).filter((id): id is string => Boolean(id)),
  );

  const match = ingested.find(
    (candidate) =>
      candidate.source === 'ghl' && !alreadyClaimed.has(candidate.id) && isSameAppointment(manual, candidate),
  );

  return match
    ? { state: 'confirmed', matchedBookingId: match.id }
    : { state: 'pending-review', matchedBookingId: null };
}

/**
 * Recomputes states across a placement's whole booking set. Ingested events with
 * no manual counterpart are `system-only` and auto-credited; a high rate there
 * just means the operator is not bothering to log, which is acceptable.
 */
export function reconcilePlacement(bookings: Booking[]): Booking[] {
  const ingested = bookings.filter((booking) => booking.source === 'ghl');
  const manual = bookings.filter((booking) => booking.source === 'manual');

  const matchedIngestedIds = new Set<string>();
  const resolvedManual = manual.map((entry) => {
    // Rejected claims stay rejected; an admin decision is not re-litigated.
    if (entry.state === 'rejected') return entry;

    const match = ingested.find(
      (candidate) => !matchedIngestedIds.has(candidate.id) && isSameAppointment(entry, candidate),
    );

    if (match) {
      matchedIngestedIds.add(match.id);
      return { ...entry, state: 'confirmed' as BookingState, matchedBookingId: match.id };
    }

    // An admin-approved claim keeps its confirmed state without a match.
    if (entry.reviewedAt && entry.state === 'confirmed') return entry;

    return { ...entry, state: 'pending-review' as BookingState, matchedBookingId: null };
  });

  const resolvedIngested = ingested.map((entry) => ({
    ...entry,
    state: (matchedIngestedIds.has(entry.id) ? 'confirmed' : 'system-only') as BookingState,
  }));

  return [...resolvedIngested, ...resolvedManual];
}

/**
 * Rule 3: commission pays only on confirmed bookings. `system-only` is credited
 * because GHL saw it; `pending-review` and `rejected` are not.
 *
 * Crucially, a matched manual entry is the *second* record of one appointment.
 * Counting it as well as its ingested twin would pay twice for a single booking,
 * which is the whole reason the two sources are reconciled rather than summed —
 * so credit sits with the ingested record and the manual echo is skipped.
 */
export function isCommissionable(booking: Booking): boolean {
  if (booking.state === 'system-only') return true;
  if (booking.state !== 'confirmed') return false;
  return !(booking.source === 'manual' && booking.matchedBookingId !== null);
}

/** Bookings that count toward quota. Same set as commission, by design. */
export function countsTowardQuota(booking: Booking): boolean {
  return isCommissionable(booking);
}

export function commissionableBookings(bookings: Booking[]): Booking[] {
  return bookings.filter(isCommissionable);
}

export function pendingBookings(bookings: Booking[]): Booking[] {
  return bookings.filter((booking) => booking.state === 'pending-review');
}

/**
 * A manual entry that duplicates an already-credited booking would double-pay,
 * so approving a claim is only safe when nothing else covers that appointment.
 */
export function wouldDoubleCredit(claim: Booking, bookings: Booking[]): boolean {
  return bookings.some(
    (other) => other.id !== claim.id && isCommissionable(other) && isSameAppointment(claim, other),
  );
}

export type ReconciliationSummary = {
  confirmed: number;
  pendingReview: number;
  systemOnly: number;
  rejected: number;
  /** Share of credited bookings the operator never logged. */
  unloggedRate: number;
};

/** Counts describe appointments, not records, so a reconciled pair counts once. */
export function summarise(bookings: Booking[]): ReconciliationSummary {
  const confirmed = bookings.filter(
    (booking) => booking.state === 'confirmed' && isCommissionable(booking),
  ).length;
  const systemOnly = bookings.filter((booking) => booking.state === 'system-only').length;
  const credited = confirmed + systemOnly;

  return {
    confirmed,
    systemOnly,
    pendingReview: bookings.filter((booking) => booking.state === 'pending-review').length,
    rejected: bookings.filter((booking) => booking.state === 'rejected').length,
    unloggedRate: credited === 0 ? 0 : systemOnly / credited,
  };
}
