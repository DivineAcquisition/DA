import { reconcilePlacement } from './bookings';
import type { Booking, Client, EodReport, Escalation, OpsData, Placement, ResponseDay } from '../types';

/**
 * Test fixtures. These belong to the tests, not the product: the application
 * itself loads everything from Postgres.
 *
 * The shape is deliberately small but covers the cases the rules turn on — a
 * reconciled pair, a pending claim, a rejection, a renewed placement, a bench
 * operator, an overdue escalation, and a missed report.
 */

export const NOW = '2026-07-26T18:40:00.000Z';
const TODAY = '2026-07-26';
const YESTERDAY = '2026-07-25';

const client = (id: string, name: string, quota: number, rate: number): Client => ({
  id,
  name,
  vertical: 'Test vertical',
  onboardedOn: '2026-03-01',
  config: {
    industry: 'med-spa',
    industryName: 'Med spa / aesthetics',
    // Inline rather than read from a template: the templates are rows in the
    // database now, and a fixture that reached for them would be asserting against
    // whatever an admin last configured.
    configuredFields: [
      { key: 'consultsBooked', label: 'Consults booked', type: 'number', required: true },
      {
        key: 'treatmentInterest',
        label: 'Primary treatment interest',
        type: 'select',
        options: ['Injectables', 'Laser', 'Mixed'],
        required: true,
      },
    ],
    shiftStart: '09:00',
    shiftEnd: '18:00',
    timeZone: 'America/New_York',
    monthlyBookingQuota: quota,
    commissionPerBooking: rate,
    responseStandardMinutes: 5,
    escalationResponseHours: 4,
    escalationContact: null,
    qualifiedBookingDefinition: 'A consult with a confirmed time.',
  },
});

const placement = (
  id: string,
  operatorId: string,
  clientId: string,
  overrides: Partial<Placement> = {},
): Placement => ({
  id,
  operatorId,
  clientId,
  startDate: '2026-06-15',
  endDate: '2026-09-15',
  termMonths: 3,
  status: 'active',
  shiftStart: '09:00',
  shiftEnd: '18:00',
  timeZone: 'America/New_York',
  monthlyBookingQuota: 20,
  commissionPerBooking: 6,
  closedOn: null,
  renewedFromId: null,
  ...overrides,
});

let seq = 0;
const booking = (overrides: Partial<Booking> & Pick<Booking, 'placementId' | 'operatorId' | 'clientId'>): Booking => {
  seq += 1;
  return {
    id: `bk-${seq}`,
    scheduledFor: `2026-07-${String((seq % 25) + 1).padStart(2, '0')}T12:00:00.000Z`,
    recordedAt: NOW,
    source: 'ghl',
    state: 'confirmed',
    customerName: `Customer ${seq}`,
    customerPhone: `+1 312 555 ${String(1000 + seq)}`,
    customerEmail: null,
    matchedBookingId: null,
    operatorNote: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    qualified: true,
    ...overrides,
  };
};

export function makeOpsData(): OpsData {
  seq = 0;

  const clients = [client('cl-lumen', 'Lumen Aesthetics', 20, 6), client('cl-solace', 'Solace Wellness', 16, 6)];

  const placements: Placement[] = [
    // A renewed term, so `isPlacementLive` has something terminal to exclude.
    placement('pl-amara-lumen-1', 'op-amara', 'cl-lumen', {
      startDate: '2026-03-15',
      endDate: '2026-06-15',
      status: 'renewed',
      closedOn: '2026-06-14',
    }),
    placement('pl-amara-lumen-2', 'op-amara', 'cl-lumen', { renewedFromId: 'pl-amara-lumen-1' }),
    placement('pl-diego-brightline', 'op-diego', 'cl-solace', {
      endDate: '2026-08-15',
      monthlyBookingQuota: 18,
      commissionPerBooking: 5,
    }),
    placement('pl-nadia-solace', 'op-nadia', 'cl-solace', {
      startDate: '2026-03-02',
      endDate: '2026-06-02',
      status: 'ended',
      closedOn: '2026-06-02',
    }),
  ];

  const rawBookings: Booking[] = [
    // 24 credited on Amara's live placement: above her quota of 20.
    ...Array.from({ length: 20 }, () =>
      booking({ placementId: 'pl-amara-lumen-2', operatorId: 'op-amara', clientId: 'cl-lumen' }),
    ),
    ...Array.from({ length: 4 }, () =>
      booking({
        placementId: 'pl-amara-lumen-2',
        operatorId: 'op-amara',
        clientId: 'cl-lumen',
        state: 'system-only',
      }),
    ),
    // A pending claim, which must never be credited.
    booking({
      placementId: 'pl-amara-lumen-2',
      operatorId: 'op-amara',
      clientId: 'cl-lumen',
      source: 'manual',
      state: 'pending-review',
      customerPhone: '+1 999 555 0000',
      operatorNote: 'Booked over the phone while the CRM was down.',
    }),
    // Diego is behind his quota of 18, which puts him at risk.
    ...Array.from({ length: 12 }, () =>
      booking({ placementId: 'pl-diego-brightline', operatorId: 'op-diego', clientId: 'cl-solace' }),
    ),
    booking({
      placementId: 'pl-diego-brightline',
      operatorId: 'op-diego',
      clientId: 'cl-solace',
      source: 'manual',
      state: 'pending-review',
      customerPhone: '+1 888 555 0000',
    }),
    booking({
      placementId: 'pl-diego-brightline',
      operatorId: 'op-diego',
      clientId: 'cl-solace',
      source: 'manual',
      state: 'rejected',
      customerPhone: '+1 777 555 0000',
      rejectionReason: 'No appointment on the client calendar.',
      reviewedAt: '2026-07-09T09:00:00.000Z',
    }),
  ];

  const byPlacement = new Map<string, Booking[]>();
  for (const item of rawBookings) {
    const bucket = byPlacement.get(item.placementId) ?? [];
    bucket.push(item);
    byPlacement.set(item.placementId, bucket);
  }
  const bookings = [...byPlacement.values()].flatMap((bucket) => reconcilePlacement(bucket));

  const eodReports: EodReport[] = [];
  const responseDays: ResponseDay[] = [];

  for (const item of placements.filter((candidate) => candidate.status === 'active')) {
    // Diego misses yesterday, so the missed-EOD exception has a subject.
    const gaps = item.id === 'pl-diego-brightline' ? new Set([YESTERDAY]) : new Set<string>();

    for (let day = 1; day <= 26; day += 1) {
      const date = `2026-07-${String(day).padStart(2, '0')}`;
      // Diego is below the response standard today.
      const rate = item.id === 'pl-diego-brightline' && date === TODAY ? 0.68 : 0.95;
      responseDays.push({
        placementId: item.id,
        date,
        conversations: 12,
        withinStandard: Math.round(12 * rate),
      });

      if (date >= TODAY || gaps.has(date)) continue;

      eodReports.push({
        id: `eod-${item.id}-${date}`,
        placementId: item.id,
        operatorId: item.operatorId,
        shiftDate: date,
        submittedAt: `${date}T18:30:00.000Z`,
        core: {
          shiftStartActual: '09:00',
          shiftEndActual: '18:00',
          conversationsHandled: 12,
          appointmentsBooked: 2,
          followUpsCompleted: 5,
          escalationsRaised: 0,
          blockers: '',
          notes: 'Steady shift.',
        },
        configured: {},
        version: 1,
        supersededById: null,
        correctionReason: null,
        adminComments: [],
      });
    }
  }

  // A closed placement keeps its history, which is the point of attaching logs
  // to a placement rather than to an operator.
  for (let day = 20; day <= 30; day += 1) {
    const date = `2026-05-${String(day).padStart(2, '0')}`;
    eodReports.push({
      id: `eod-pl-nadia-solace-${date}`,
      placementId: 'pl-nadia-solace',
      operatorId: 'op-nadia',
      shiftDate: date,
      submittedAt: `${date}T17:30:00.000Z`,
      core: {
        shiftStartActual: '09:00',
        shiftEndActual: '17:00',
        conversationsHandled: 10,
        appointmentsBooked: 2,
        followUpsCompleted: 4,
        escalationsRaised: 0,
        blockers: '',
        notes: 'Steady shift.',
      },
      configured: {},
      version: 1,
      supersededById: null,
      correctionReason: null,
      adminComments: [],
    });
  }

  const escalations: Escalation[] = [
    // Overdue: this is what should lead the admin queue.
    {
      id: 'esc-overdue',
      placementId: 'pl-diego-brightline',
      operatorId: 'op-diego',
      clientId: 'cl-solace',
      category: 'pricing-exception',
      customerContext: 'Returning customer asking for a 2024 rate.',
      needed: 'Honour the old rate or hold the price list?',
      status: 'open',
      raisedAt: '2026-07-25T14:10:00.000Z',
      responseDueAt: '2026-07-25T20:10:00.000Z',
      answeredAt: null,
      answer: null,
      answeredBy: null,
      closedAt: null,
      routedTo: ['Malik Sannie'],
    },
    {
      id: 'esc-answered',
      placementId: 'pl-amara-lumen-2',
      operatorId: 'op-amara',
      clientId: 'cl-lumen',
      category: 'clinical',
      customerContext: 'Customer on a blood thinner asking about injectables.',
      needed: 'Clinical sign-off before booking.',
      status: 'answered',
      raisedAt: '2026-07-23T11:20:00.000Z',
      responseDueAt: '2026-07-23T15:20:00.000Z',
      answeredAt: '2026-07-23T13:40:00.000Z',
      answer: 'Correct call. Book it and flag it for clinical screening at intake.',
      answeredBy: 'admin',
      closedAt: null,
      routedTo: ['Malik Sannie'],
    },
  ];

  return {
    now: NOW,
    staffNames: ['Malik Sannie'],
    operators: [
      {
        id: 'op-amara',
        name: 'Amara Ochieng',
        handle: 'amara',
        email: 'amara@example.com',
        phone: '+254 712 004 118',
        country: 'Kenya',
        timeZone: 'Africa/Nairobi',
        status: 'placed',
        tier: 3,
        baseMonthly: 600,
        certifiedOn: '2026-02-27',
        joinedOn: '2026-02-02',
        preferredChannel: 'whatsapp',
        trainingAssignments: [],
      },
      {
        id: 'op-diego',
        name: 'Diego Salcedo',
        handle: 'diego',
        email: 'diego@example.com',
        phone: '+63 917 552 8841',
        country: 'Philippines',
        timeZone: 'Asia/Manila',
        status: 'placed',
        tier: 2,
        baseMonthly: 500,
        certifiedOn: '2026-04-18',
        joinedOn: '2026-03-30',
        preferredChannel: 'discord',
        trainingAssignments: [],
      },
      {
        id: 'op-nadia',
        name: 'Nadia Rahman',
        handle: 'nadia',
        email: 'nadia@example.com',
        phone: '+880 1712 449 003',
        country: 'Bangladesh',
        timeZone: 'Asia/Dhaka',
        status: 'on-bench',
        tier: 2,
        baseMonthly: 500,
        certifiedOn: '2026-02-20',
        joinedOn: '2026-01-26',
        preferredChannel: 'whatsapp',
        trainingAssignments: [],
      },
    ],
    clients,
    placements,
    eodReports,
    bookings,
    escalations,
    scopeRequests: [],
    adminNotes: [],
    evidence: [],
    notifications: [],
    tasks: [],
    payPeriods: [
      { id: 'pp-2026-07-a', start: '2026-07-01', end: '2026-07-15', closesMonth: false, status: 'closed', closedAt: '2026-07-17T12:00:00.000Z' },
      { id: 'pp-2026-07-b', start: '2026-07-16', end: '2026-07-31', closesMonth: true, status: 'open', closedAt: null },
    ],
    payStatements: [
      {
        id: 'stmt-locked',
        operatorId: 'op-amara',
        placementId: 'pl-amara-lumen-2',
        periodId: 'pp-2026-07-a',
        baseAmount: 290.32,
        baseDetail: 'Tier 3 base prorated.',
        commissionAmount: 0,
        commissionDetail: 'Settles at month close.',
        commissionBookingIds: [],
        speedBonusAmount: 0,
        speedBonusDetail: 'Monthly.',
        adjustments: [],
        total: 290.32,
        locked: true,
        lockedAt: '2026-07-17T12:00:00.000Z',
      },
      {
        id: 'stmt-open',
        operatorId: 'op-amara',
        placementId: 'pl-amara-lumen-2',
        periodId: 'pp-2026-07-b',
        baseAmount: 309.68,
        baseDetail: 'Tier 3 base prorated.',
        commissionAmount: 24,
        commissionDetail: '24 confirmed against a quota of 20.',
        commissionBookingIds: [],
        speedBonusAmount: 90,
        speedBonusDetail: 'Held the standard.',
        adjustments: [],
        total: 423.68,
        locked: false,
        lockedAt: null,
      },
    ],
    responseDays,
  };
}
