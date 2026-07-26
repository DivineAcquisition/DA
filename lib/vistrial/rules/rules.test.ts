import { describe, expect, it } from 'vitest';
import {
  AccessDeniedError,
  assertCanReadOperator,
  scopeByPlacement,
  visiblePlacements,
} from '../access';
import { CORE_FIELD_KEYS, getIndustryTemplate } from '../industries';
import { createGateway } from '../gateway';
import { createSeedData, NOW } from '../seed';
import type { Actor, Booking, CaseFileConfig, Operator, PayPeriod, Placement } from '../types';
import {
  commissionableBookings,
  isCommissionable,
  isSameAppointment,
  MATCH_WINDOW_MINUTES,
  reconcileManualEntry,
  reconcilePlacement,
  summarise,
  wouldDoubleCredit,
} from './bookings';
import { assertConfiguredFieldsDoNotShadowCore, correctEod, currentVersions } from './eod';
import { buildExceptionQueue, EXCEPTION_RANK } from './exceptions';
import { canTransitionOperator, endPlacement, isPlacementLive, placementStatus } from './lifecycle';
import { deliver, resolveChannels } from './notifications';
import { computeBase, computeCommission, computeSpeedBonus, computeStatement, lockStatement } from './pay';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const placement: Placement = {
  id: 'pl-1',
  operatorId: 'op-1',
  clientId: 'cl-1',
  startDate: '2026-07-01',
  endDate: '2026-10-01',
  termMonths: 3,
  status: 'active',
  shiftStart: '09:00',
  shiftEnd: '18:00',
  timeZone: 'America/New_York',
  monthlyBookingQuota: 10,
  commissionPerBooking: 6,
  closedOn: null,
  renewedFromId: null,
};

const operator: Operator = {
  id: 'op-1',
  name: 'Test Operator',
  handle: 'test',
  email: 'test@example.com',
  phone: '+1 555 000 0000',
  country: 'Kenya',
  timeZone: 'Africa/Nairobi',
  status: 'placed',
  tier: 2,
  baseMonthly: 500,
  certifiedOn: '2026-06-01',
  joinedOn: '2026-05-01',
  preferredChannel: 'discord',
  trainingAssignments: [],
};

const firstHalf: PayPeriod = {
  id: 'pp-a',
  start: '2026-07-01',
  end: '2026-07-15',
  closesMonth: false,
  status: 'open',
  closedAt: null,
};

const secondHalf: PayPeriod = {
  id: 'pp-b',
  start: '2026-07-16',
  end: '2026-07-31',
  closesMonth: true,
  status: 'open',
  closedAt: null,
};

let bookingSeq = 0;
function booking(overrides: Partial<Booking> = {}): Booking {
  bookingSeq += 1;
  return {
    id: `bk-${bookingSeq}`,
    placementId: 'pl-1',
    operatorId: 'op-1',
    clientId: 'cl-1',
    scheduledFor: '2026-07-05T14:00:00.000Z',
    recordedAt: '2026-07-05T14:00:00.000Z',
    source: 'ghl',
    state: 'confirmed',
    customerName: 'Ruth Adeyemi',
    customerPhone: '+1 312 555 0101',
    customerEmail: 'ruth@example.com',
    matchedBookingId: null,
    operatorNote: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    qualified: true,
    ...overrides,
  };
}

/** `count` credited bookings spread across the month, earliest first. */
function creditedBookings(count: number, month = '2026-07'): Booking[] {
  return Array.from({ length: count }, (_, index) =>
    booking({
      id: `bk-credit-${month}-${index}`,
      scheduledFor: `${month}-${String((index % 27) + 1).padStart(2, '0')}T12:00:00.000Z`,
      state: 'confirmed',
    }),
  );
}

// ---------------------------------------------------------------------------
// Rule 3: commission pays only on confirmed bookings
// ---------------------------------------------------------------------------

describe('booking reconciliation', () => {
  it('confirms a manual entry that matches an ingested event on phone', () => {
    const ingested = booking({ source: 'ghl' });
    const manual = booking({ source: 'manual', customerEmail: null });
    expect(reconcileManualEntry(manual, [ingested])).toEqual({
      state: 'confirmed',
      matchedBookingId: ingested.id,
    });
  });

  it('matches phone numbers that differ only by country-code formatting', () => {
    const ingested = booking({ customerPhone: '+1 (312) 555-0101' });
    const manual = booking({ source: 'manual', customerPhone: '3125550101', customerEmail: null });
    expect(isSameAppointment(manual, ingested)).toBe(true);
  });

  it('holds a manual entry with no ingested counterpart for review', () => {
    const manual = booking({ source: 'manual', customerPhone: '+1 999 555 0000', customerEmail: null });
    expect(reconcileManualEntry(manual, [booking()])).toEqual({
      state: 'pending-review',
      matchedBookingId: null,
    });
  });

  it('does not match across placements', () => {
    const ingested = booking({ placementId: 'pl-other' });
    const manual = booking({ source: 'manual' });
    expect(isSameAppointment(manual, ingested)).toBe(false);
  });

  it('does not match outside the time window', () => {
    const ingested = booking({ scheduledFor: '2026-07-05T14:00:00.000Z' });
    const manual = booking({
      source: 'manual',
      scheduledFor: `2026-07-05T${14 + MATCH_WINDOW_MINUTES / 60 + 1}:00:00.000Z`,
    });
    expect(isSameAppointment(manual, ingested)).toBe(false);
  });

  it('never lets one ingested event confirm two manual claims', () => {
    const ingested = booking({ id: 'ghl-1', source: 'ghl' });
    const claimA = booking({ id: 'man-a', source: 'manual', customerEmail: null });
    const claimB = booking({ id: 'man-b', source: 'manual', customerEmail: null });

    const resolved = reconcilePlacement([ingested, claimA, claimB]);
    const confirmedManual = resolved.filter((b) => b.source === 'manual' && b.state === 'confirmed');
    const pendingManual = resolved.filter((b) => b.state === 'pending-review');

    expect(confirmedManual).toHaveLength(1);
    expect(pendingManual).toHaveLength(1);
  });

  it('marks an unlogged ingested booking as system-only and still credits it', () => {
    const resolved = reconcilePlacement([booking({ id: 'ghl-solo', source: 'ghl' })]);
    expect(resolved[0].state).toBe('system-only');
    expect(isCommissionable(resolved[0])).toBe(true);
  });

  it('credits confirmed and system-only, never pending or rejected', () => {
    const set = [
      booking({ state: 'confirmed' }),
      booking({ state: 'system-only' }),
      booking({ state: 'pending-review' }),
      booking({ state: 'rejected' }),
    ];
    expect(commissionableBookings(set)).toHaveLength(2);
  });

  // The point of reconciling rather than summing: one appointment, one credit.
  it('credits a reconciled pair once, not twice', () => {
    const resolved = reconcilePlacement([
      booking({ id: 'ghl-1', source: 'ghl' }),
      booking({ id: 'man-1', source: 'manual', customerEmail: null }),
    ]);

    expect(resolved.filter((b) => b.state === 'confirmed')).toHaveLength(2);
    expect(commissionableBookings(resolved)).toHaveLength(1);
    expect(commissionableBookings(resolved)[0].source).toBe('ghl');
    expect(summarise(resolved).confirmed).toBe(1);
  });

  it('does not let a logged booking inflate quota against an unlogged one', () => {
    const resolved = reconcilePlacement([
      booking({ id: 'ghl-a', source: 'ghl', scheduledFor: '2026-07-05T14:00:00.000Z' }),
      booking({ id: 'man-a', source: 'manual', customerEmail: null, scheduledFor: '2026-07-05T14:00:00.000Z' }),
      booking({
        id: 'ghl-b',
        source: 'ghl',
        scheduledFor: '2026-07-06T14:00:00.000Z',
        customerName: 'Marcus Blake',
        customerPhone: '+1 312 555 0999',
      }),
    ]);
    // Two appointments happened, one of which the operator also logged.
    expect(commissionableBookings(resolved)).toHaveLength(2);
  });

  it('leaves an admin rejection alone on re-reconciliation', () => {
    const rejected = booking({
      source: 'manual',
      state: 'rejected',
      reviewedBy: 'DA Admin',
      reviewedAt: '2026-07-06T10:00:00.000Z',
    });
    const resolved = reconcilePlacement([booking({ source: 'ghl' }), rejected]);
    expect(resolved.find((b) => b.id === rejected.id)?.state).toBe('rejected');
  });

  it('keeps an approved claim confirmed even without a matching event', () => {
    const approved = booking({
      source: 'manual',
      state: 'confirmed',
      customerPhone: '+1 999 555 0000',
      customerEmail: null,
      reviewedBy: 'DA Admin',
      reviewedAt: '2026-07-06T10:00:00.000Z',
    });
    const resolved = reconcilePlacement([approved]);
    expect(resolved.find((b) => b.id === approved.id)?.state).toBe('confirmed');
  });

  it('flags a claim that would double-credit an already-credited appointment', () => {
    const credited = booking({ state: 'system-only' });
    const claim = booking({ source: 'manual', state: 'pending-review', customerEmail: null });
    expect(wouldDoubleCredit(claim, [credited, claim])).toBe(true);
  });

  it('reports the share of credited bookings the operator never logged', () => {
    const summary = summarise([
      booking({ state: 'confirmed' }),
      booking({ state: 'system-only' }),
      booking({ state: 'system-only' }),
      booking({ state: 'pending-review' }),
    ]);
    expect(summary.confirmed).toBe(1);
    expect(summary.systemOnly).toBe(2);
    expect(summary.pendingReview).toBe(1);
    expect(summary.unloggedRate).toBeCloseTo(2 / 3);
  });
});

// ---------------------------------------------------------------------------
// Pay
// ---------------------------------------------------------------------------

describe('pay computation', () => {
  it('prorates base so both halves of a fully worked month sum to the monthly base', () => {
    const a = computeBase(operator, placement, firstHalf);
    const b = computeBase(operator, placement, secondHalf);
    expect(a.amount + b.amount).toBeCloseTo(operator.baseMonthly, 2);
  });

  it('prorates base by the days the placement was actually active', () => {
    const midMonthStart: Placement = { ...placement, startDate: '2026-07-08' };
    const result = computeBase(operator, midMonthStart, firstHalf);
    expect(result.activeDays).toBe(8);
    expect(result.amount).toBeCloseTo((500 * 8) / 31, 2);
  });

  it('pays nothing when the placement was not active in the period', () => {
    const ended: Placement = { ...placement, startDate: '2026-08-01', endDate: '2026-11-01' };
    expect(computeBase(operator, ended, firstHalf).amount).toBe(0);
  });

  it('holds commission on the mid-month period because quota is monthly', () => {
    const result = computeCommission(placement, firstHalf, creditedBookings(14));
    expect(result.amount).toBe(0);
    expect(result.settlesThisPeriod).toBe(false);
    expect(result.monthlyCredited).toBe(14);
    expect(result.detail).toContain('settles on the period that closes the month');
  });

  it('settles commission on the month-closing period, above quota only', () => {
    const result = computeCommission(placement, secondHalf, creditedBookings(14));
    expect(result.aboveQuota).toBe(4);
    expect(result.amount).toBe(4 * 6);
    expect(result.payableBookingIds).toHaveLength(4);
  });

  it('pays no commission below quota', () => {
    const result = computeCommission(placement, secondHalf, creditedBookings(9));
    expect(result.aboveQuota).toBe(0);
    expect(result.amount).toBe(0);
  });

  it('excludes pending and rejected claims from commission', () => {
    const set = [
      ...creditedBookings(10),
      booking({ id: 'p1', state: 'pending-review', scheduledFor: '2026-07-28T12:00:00.000Z' }),
      booking({ id: 'p2', state: 'rejected', scheduledFor: '2026-07-29T12:00:00.000Z' }),
    ];
    expect(computeCommission(placement, secondHalf, set).amount).toBe(0);
  });

  it('counts only bookings scheduled inside the statement month', () => {
    const set = [...creditedBookings(12), ...creditedBookings(6, '2026-06')];
    expect(computeCommission(placement, secondHalf, set).monthlyCredited).toBe(12);
  });

  it('names the exact bookings behind the commission so it can be audited', () => {
    const set = creditedBookings(13);
    const result = computeCommission(placement, secondHalf, set);
    // The earliest 10 clear quota; the remaining 3 are what paid.
    expect(result.payableBookingIds).toEqual(set.slice(10).map((b) => b.id));
  });

  it('awards the speed bonus only when the standard held all month', () => {
    const held = computeSpeedBonus(operator, placement, secondHalf, [
      { placementId: 'pl-1', date: '2026-07-04', conversations: 50, withinStandard: 48 },
      { placementId: 'pl-1', date: '2026-07-20', conversations: 50, withinStandard: 46 },
    ]);
    expect(held.awarded).toBe(true);
    expect(held.amount).toBe(60);

    const missed = computeSpeedBonus(operator, placement, secondHalf, [
      { placementId: 'pl-1', date: '2026-07-04', conversations: 50, withinStandard: 40 },
    ]);
    expect(missed.awarded).toBe(false);
    expect(missed.amount).toBe(0);
  });

  it('defers the speed bonus off the mid-month period', () => {
    const result = computeSpeedBonus(operator, placement, firstHalf, [
      { placementId: 'pl-1', date: '2026-07-04', conversations: 50, withinStandard: 50 },
    ]);
    expect(result.amount).toBe(0);
  });

  it('applies positive and negative adjustments to the total', () => {
    const statement = computeStatement({
      operator,
      placement,
      period: secondHalf,
      bookingsForPlacement: creditedBookings(12),
      responseDays: [],
      adjustments: [
        { id: 'a1', statementId: 's', label: 'Stipend', reason: 'Headset', amount: 45, addedBy: 'DA Admin', addedAt: NOW },
        { id: 'a2', statementId: 's', label: 'Absence', reason: 'Missed shift', amount: -30, addedBy: 'DA Admin', addedAt: NOW },
      ],
    });
    expect(statement.total).toBeCloseTo(statement.baseAmount + 12 + 15, 2);
  });

  // Rule 6: closed pay statements do not change.
  it('refuses to recompute a locked statement', () => {
    const locked = lockStatement(
      computeStatement({
        operator,
        placement,
        period: secondHalf,
        bookingsForPlacement: creditedBookings(11),
        responseDays: [],
      }),
      NOW,
    );

    const recomputed = computeStatement({
      operator,
      placement,
      period: secondHalf,
      bookingsForPlacement: creditedBookings(40),
      responseDays: [],
      existing: locked,
    });

    expect(recomputed).toBe(locked);
    expect(recomputed.commissionAmount).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Rules 2 and 4: immutable logs, fixed core
// ---------------------------------------------------------------------------

describe('EOD', () => {
  const config: CaseFileConfig = {
    industry: 'med-spa',
    configuredFields: getIndustryTemplate('med-spa').configuredFields,
    shiftStart: '09:00',
    shiftEnd: '18:00',
    timeZone: 'America/New_York',
    monthlyBookingQuota: 10,
    commissionPerBooking: 6,
    responseStandardMinutes: 5,
    escalationResponseHours: 4,
    escalationContact: null,
    qualifiedBookingDefinition: 'A consult with a confirmed time.',
  };

  const report = {
    id: 'eod-1',
    placementId: 'pl-1',
    operatorId: 'op-1',
    shiftDate: '2026-07-20',
    submittedAt: '2026-07-20T18:30:00.000Z',
    core: {
      shiftStartActual: '09:00',
      shiftEndActual: '18:00',
      conversationsHandled: 12,
      appointmentsBooked: 3,
      followUpsCompleted: 5,
      escalationsRaised: 0,
      blockers: '',
      notes: 'Steady.',
    },
    configured: {},
    version: 1,
    supersededById: null,
    correctionReason: null,
    adminComments: [],
  };

  it('keeps the superseded version visible when a correction is filed', () => {
    const { superseded, correction } = correctEod(
      report,
      { ...report, core: { ...report.core, followUpsCompleted: 7 } },
      'Undercounted follow-ups.',
      '2026-07-21T09:00:00.000Z',
    );

    expect(superseded.core.followUpsCompleted).toBe(5);
    expect(superseded.supersededById).toBe(correction.id);
    expect(correction.version).toBe(2);
    expect(correction.correctionReason).toBe('Undercounted follow-ups.');
    expect(currentVersions([superseded, correction])).toEqual([correction]);
  });

  it('rejects a configured field that shadows a locked core key', () => {
    expect(() =>
      assertConfiguredFieldsDoNotShadowCore({
        ...config,
        configuredFields: [
          { key: 'appointmentsBooked', label: 'Appointments booked', type: 'number', required: true },
        ],
      }),
    ).toThrow(/locked core keys/);
  });

  it('accepts industry fields that sit alongside the core', () => {
    expect(() => assertConfiguredFieldsDoNotShadowCore(config)).not.toThrow();
  });

  it('keeps the core out of every industry template', () => {
    for (const industry of ['med-spa', 'cleaning', 'coaching', 'home-services', 'generic'] as const) {
      for (const field of getIndustryTemplate(industry).configuredFields) {
        expect(CORE_FIELD_KEYS).not.toContain(field.key);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Rule 1: operators see only their own data
// ---------------------------------------------------------------------------

describe('access control', () => {
  const data = createSeedData();
  const admin: Actor = { role: 'admin', id: 'admin-1', name: 'DA Admin' };
  const diego: Actor = { role: 'operator', id: 'op-diego', name: 'Diego Salcedo' };

  it('narrows placements to the requesting operator', () => {
    expect(visiblePlacements(admin, data)).toHaveLength(data.placements.length);
    expect(visiblePlacements(diego, data).every((p) => p.operatorId === 'op-diego')).toBe(true);
  });

  it('narrows placement-scoped records without the caller filtering', () => {
    const scoped = scopeByPlacement(diego, data.bookings, data);
    const allowed = new Set(visiblePlacements(diego, data).map((p) => p.id));
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((booking) => allowed.has(booking.placementId))).toBe(true);
    expect(scoped.length).toBeLessThan(data.bookings.length);
  });

  it('refuses a direct read of another operator', () => {
    expect(() => assertCanReadOperator(diego, 'op-amara')).toThrow(AccessDeniedError);
    expect(() => assertCanReadOperator(admin, 'op-amara')).not.toThrow();
  });

  it('refuses a direct read of another placement through the gateway', () => {
    const gateway = createGateway(data, diego);
    expect(() => gateway.bookingsFor('pl-amara-lumen-2')).toThrow(AccessDeniedError);
    expect(() => gateway.metricsFor('pl-amara-lumen-2')).toThrow(AccessDeniedError);
    expect(() => gateway.reportsFor('pl-amara-lumen-2')).toThrow(AccessDeniedError);
  });

  it('keeps admin-only surfaces away from operators', () => {
    const gateway = createGateway(data, diego);
    expect(() => gateway.exceptions()).toThrow(AccessDeniedError);
    expect(() => gateway.reviewQueue()).toThrow(AccessDeniedError);
    expect(() => gateway.allOperators()).toThrow(AccessDeniedError);
    expect(() => gateway.bench()).toThrow(AccessDeniedError);
  });

  it('lets an operator read their own placement', () => {
    const gateway = createGateway(data, diego);
    expect(() => gateway.bookingsFor('pl-diego-brightline')).not.toThrow();
    expect(gateway.statements().every((statement) => statement.operatorId === 'op-diego')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

describe('notification routing', () => {
  it('routes by severity', () => {
    expect(resolveChannels('informational', operator)).toEqual(['discord', 'in-app']);
    expect(resolveChannels('important', operator)).toEqual(['discord', 'in-app', 'email']);
  });

  it('ignores channel preference for urgent notifications', () => {
    const emailFirst = { preferredChannel: 'email' as const };
    expect(resolveChannels('urgent', emailFirst)).toEqual(['in-app', 'discord', 'email', 'whatsapp']);
  });

  it('records every attempt, including channels it deliberately skipped', () => {
    const attempts = deliver(
      { severity: 'informational', title: 'Task assigned', body: 'Do the thing.' },
      operator,
      () => ({ ok: true }),
      NOW,
    );
    expect(attempts).toHaveLength(4);
    expect(attempts.filter((a) => a.status === 'delivered')).toHaveLength(2);
    expect(attempts.filter((a) => a.status === 'skipped').map((a) => a.channel)).toEqual([
      'email',
      'whatsapp',
    ]);
  });

  it('falls back to WhatsApp when every routed channel fails', () => {
    const attempts = deliver(
      { severity: 'important', title: 'Quota warning', body: 'Behind quota.' },
      operator,
      (channel) => ({ ok: channel === 'whatsapp', detail: channel === 'whatsapp' ? undefined : 'Transport down.' }),
      NOW,
    );
    const whatsapp = attempts.find((a) => a.channel === 'whatsapp');
    expect(whatsapp?.status).toBe('delivered');
    expect(attempts.filter((a) => a.status === 'failed')).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('lifecycle', () => {
  it('reads an active placement inside the window as expiring', () => {
    expect(placementStatus({ ...placement, endDate: '2026-08-10' }, NOW)).toBe('expiring');
    expect(placementStatus({ ...placement, endDate: '2026-10-01' }, NOW)).toBe('active');
    expect(placementStatus({ ...placement, status: 'ended' }, NOW)).toBe('ended');
  });

  it('moves the operator to the bench when a placement ends', () => {
    const result = endPlacement(placement, operator, '2026-07-26');
    expect(result.placement.status).toBe('ended');
    expect(result.placement.closedOn).toBe('2026-07-26');
    expect(result.operator.status).toBe('on-bench');
    expect(result.movedToBench).toBe(true);
  });

  it('refuses transitions that skip the pipeline', () => {
    expect(canTransitionOperator('applicant', 'placed')).toBe(false);
    expect(canTransitionOperator('certified', 'placed')).toBe(true);
    expect(canTransitionOperator('on-bench', 'placed')).toBe(true);
  });

  // A renewal opens a new placement, so the superseded one is not still running.
  it('does not treat a renewed placement as live', () => {
    expect(isPlacementLive({ ...placement, status: 'renewed' })).toBe(false);
    expect(isPlacementLive({ ...placement, status: 'active' })).toBe(true);
    expect(isPlacementLive({ ...placement, status: 'ended' })).toBe(false);
  });

  it('counts one live placement per operator in the seed', () => {
    const data = createSeedData();
    const liveByOperator = new Map<string, number>();
    for (const item of data.placements.filter(isPlacementLive)) {
      liveByOperator.set(item.operatorId, (liveByOperator.get(item.operatorId) ?? 0) + 1);
    }
    for (const count of liveByOperator.values()) expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Rule 5, and the exception queue order
// ---------------------------------------------------------------------------

describe('exception queue', () => {
  const data = createSeedData();
  const queue = buildExceptionQueue({
    operators: data.operators,
    clients: data.clients,
    placements: data.placements,
    bookings: data.bookings,
    eodReports: data.eodReports,
    escalations: data.escalations,
    responseDays: data.responseDays,
    now: data.now,
  });

  it('surfaces every exception kind the admin view promises', () => {
    const kinds = new Set(queue.map((exception) => exception.kind));
    expect(kinds).toContain('escalation-overdue');
    expect(kinds).toContain('response-below-standard');
    expect(kinds).toContain('missed-eod');
    expect(kinds).toContain('booking-review');
    expect(kinds).toContain('quota-at-risk');
    expect(kinds).toContain('placement-expiring');
  });

  it('orders by the fixed priority, escalations first', () => {
    const ranks = queue.map((exception) => exception.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(queue[0].kind).toBe('escalation-overdue');
    expect(EXCEPTION_RANK['escalation-overdue']).toBeLessThan(EXCEPTION_RANK['placement-expiring']);
  });
});

// Rule 5: everything logs against a placement, never directly against a client.
describe('seed integrity', () => {
  const data = createSeedData();
  const placementIds = new Set(data.placements.map((item) => item.id));

  it('attaches every log to a real placement', () => {
    for (const collection of [data.eodReports, data.bookings, data.escalations]) {
      for (const record of collection) {
        expect(placementIds.has(record.placementId)).toBe(true);
      }
    }
  });

  it('leaves a closed placement history attached to the client', () => {
    const ended = data.placements.find((item) => item.id === 'pl-nadia-solace')!;
    expect(ended.status).toBe('ended');
    expect(data.eodReports.some((report) => report.placementId === ended.id)).toBe(true);
    expect(data.operators.find((op) => op.id === 'op-nadia')?.status).toBe('on-bench');
  });

  it('locks every statement whose period has closed', () => {
    for (const period of data.payPeriods.filter((item) => item.status === 'closed')) {
      const statements = data.payStatements.filter((item) => item.periodId === period.id);
      expect(statements.length).toBeGreaterThan(0);
      expect(statements.every((item) => item.locked)).toBe(true);
    }
    expect(
      data.payStatements.filter((item) => item.periodId === 'pp-2026-07-b').every((item) => !item.locked),
    ).toBe(true);
  });
});
