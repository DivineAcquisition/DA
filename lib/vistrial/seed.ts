import { addDays, eachDay, monthKey, toDay } from './dates';
import { getIndustryTemplate } from './industries';
import { reconcilePlacement } from './rules/bookings';
import { computeStatement, lockStatement } from './rules/pay';
import type {
  AdminNote,
  Booking,
  Client,
  EodReport,
  Escalation,
  Evidence,
  Notification,
  Operator,
  OperatorTask,
  OpsData,
  PayPeriod,
  PayStatement,
  Placement,
  ResponseDay,
  ScopeRequest,
} from './types';

/**
 * Demo data for the hub. Facts are seeded; everything derived — booking states,
 * pay statements — is produced by the same rule functions the app uses, so the
 * fixtures cannot drift away from the logic they illustrate.
 */

/** Fixed "today" so the exception queue and pay periods are deterministic. */
export const NOW = '2026-07-26T18:40:00.000Z';
const TODAY = toDay(NOW);
const YESTERDAY = addDays(TODAY, -1);

/** mulberry32 — small, deterministic, good enough for fixtures. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(random: () => number, items: T[]): T => items[Math.floor(random() * items.length)];

const FIRST_NAMES = ['Ruth', 'Marcus', 'Priya', 'Elena', 'Damien', 'Tobi', 'Hannah', 'Luis', 'Grace', 'Omar', 'Sofia', 'Caleb', 'Yara', 'Nate', 'Iris', 'Kwame'];
const LAST_NAMES = ['Adeyemi', 'Blake', 'Contreras', 'Duarte', 'Ellison', 'Farrell', 'Gonzalez', 'Hoffman', 'Iqbal', 'Jensen', 'Kaplan', 'Lindqvist'];

const customer = (random: () => number, index: number) => {
  const name = `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`;
  const phone = `+1 ${200 + Math.floor(random() * 700)} ${100 + Math.floor(random() * 899)} ${1000 + Math.floor(random() * 8999)}`;
  const email = `${name.toLowerCase().replace(/[^a-z]/g, '.')}${index}@example.com`;
  return { name, phone, email };
};

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

const operators: Operator[] = [
  {
    id: 'op-amara',
    name: 'Amara Ochieng',
    handle: 'amara.o',
    email: 'amara@divineacquisition.io',
    phone: '+254 712 004 118',
    country: 'Kenya',
    timeZone: 'Africa/Nairobi',
    status: 'placed',
    tier: 3,
    baseMonthly: 600,
    certifiedOn: '2026-02-27',
    joinedOn: '2026-02-02',
    preferredChannel: 'whatsapp',
    trainingAssignments: [
      { id: 'tr-1', title: 'Speed-to-lead fundamentals', detail: 'Response windows, first-touch scripting, and the five-minute rule.', completedOn: '2026-02-14' },
      { id: 'tr-2', title: 'Objection handling for aesthetics', detail: 'Pricing deflection and clinical boundary scripts.', completedOn: '2026-02-24' },
    ],
  },
  {
    id: 'op-diego',
    name: 'Diego Salcedo',
    handle: 'diego.s',
    email: 'diego@divineacquisition.io',
    phone: '+63 917 552 8841',
    country: 'Philippines',
    timeZone: 'Asia/Manila',
    status: 'placed',
    tier: 2,
    baseMonthly: 500,
    certifiedOn: '2026-04-18',
    joinedOn: '2026-03-30',
    preferredChannel: 'discord',
    trainingAssignments: [
      { id: 'tr-3', title: 'Speed-to-lead fundamentals', detail: 'Response windows, first-touch scripting, and the five-minute rule.', completedOn: '2026-04-08' },
      { id: 'tr-4', title: 'Quote-led booking flow', detail: 'Turning a service enquiry into a scheduled walkthrough.', completedOn: '2026-04-16' },
    ],
  },
  {
    id: 'op-mei',
    name: 'Mei Ling Tan',
    handle: 'mei.t',
    email: 'mei@divineacquisition.io',
    phone: '+60 12 664 9027',
    country: 'Malaysia',
    timeZone: 'Asia/Kuala_Lumpur',
    status: 'placed',
    tier: 2,
    baseMonthly: 500,
    certifiedOn: '2026-05-09',
    joinedOn: '2026-04-20',
    preferredChannel: 'email',
    trainingAssignments: [
      { id: 'tr-5', title: 'Application review standard', detail: 'Fit criteria, disqualification language, and show-rate protection.', completedOn: '2026-05-06' },
    ],
  },
  {
    id: 'op-tomas',
    name: 'Tomás Herrera',
    handle: 'tomas.h',
    email: 'tomas@divineacquisition.io',
    phone: '+52 55 8841 2290',
    country: 'Mexico',
    timeZone: 'America/Mexico_City',
    status: 'placed',
    tier: 1,
    baseMonthly: 400,
    certifiedOn: '2026-07-08',
    joinedOn: '2026-06-15',
    preferredChannel: 'in-app',
    trainingAssignments: [
      { id: 'tr-6', title: 'Speed-to-lead fundamentals', detail: 'Response windows, first-touch scripting, and the five-minute rule.', completedOn: '2026-07-02' },
      { id: 'tr-7', title: 'Dispatch and arrival windows', detail: 'Booking on-site estimates without overpromising a technician.', completedOn: '2026-07-07' },
    ],
  },
  {
    id: 'op-nadia',
    name: 'Nadia Rahman',
    handle: 'nadia.r',
    email: 'nadia@divineacquisition.io',
    phone: '+880 1712 449 003',
    country: 'Bangladesh',
    timeZone: 'Asia/Dhaka',
    status: 'on-bench',
    tier: 2,
    baseMonthly: 500,
    certifiedOn: '2026-02-20',
    joinedOn: '2026-01-26',
    preferredChannel: 'whatsapp',
    trainingAssignments: [
      { id: 'tr-8', title: 'Speed-to-lead fundamentals', detail: 'Response windows, first-touch scripting, and the five-minute rule.', completedOn: '2026-02-10' },
      { id: 'tr-9', title: 'Med spa consult certification', detail: 'Refresher assigned while on the bench, ahead of re-placement.', completedOn: null },
    ],
  },
  {
    id: 'op-ife',
    name: 'Ifeoma Nwosu',
    handle: 'ife.n',
    email: 'ifeoma@divineacquisition.io',
    phone: '+234 803 771 5520',
    country: 'Nigeria',
    timeZone: 'Africa/Lagos',
    status: 'in-training',
    tier: 1,
    baseMonthly: 400,
    certifiedOn: null,
    joinedOn: '2026-07-13',
    preferredChannel: 'discord',
    trainingAssignments: [
      { id: 'tr-10', title: 'Speed-to-lead fundamentals', detail: 'Response windows, first-touch scripting, and the five-minute rule.', completedOn: '2026-07-21' },
      { id: 'tr-11', title: 'Certification assessment', detail: 'Live roleplay scored against the response standard.', completedOn: null },
    ],
  },
];

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const clients: Client[] = [
  {
    id: 'cl-lumen',
    name: 'Lumen Aesthetics',
    vertical: 'Med spa, three locations',
    onboardedOn: '2026-03-10',
    config: {
      industry: 'med-spa',
      configuredFields: getIndustryTemplate('med-spa').configuredFields,
      shiftStart: '09:00',
      shiftEnd: '18:00',
      timeZone: 'America/New_York',
      monthlyBookingQuota: 20,
      commissionPerBooking: 6,
      responseStandardMinutes: 5,
      escalationResponseHours: 4,
      escalationContact: { name: 'Dr. Renata Vos', role: 'Clinical director', channel: 'WhatsApp group' },
      qualifiedBookingDefinition:
        'A consult booked with a confirmed time, a named treatment interest, and a reachable phone number.',
    },
  },
  {
    id: 'cl-brightline',
    name: 'Brightline Cleaning Co.',
    vertical: 'Recurring residential cleaning',
    onboardedOn: '2026-05-28',
    config: {
      industry: 'cleaning',
      configuredFields: getIndustryTemplate('cleaning').configuredFields,
      shiftStart: '08:00',
      shiftEnd: '17:00',
      timeZone: 'America/Chicago',
      monthlyBookingQuota: 18,
      commissionPerBooking: 5,
      responseStandardMinutes: 10,
      escalationResponseHours: 6,
      escalationContact: { name: 'Owen Pratt', role: 'Operations lead', channel: 'Email' },
      qualifiedBookingDefinition:
        'A walkthrough or first clean scheduled with an address, a service type, and a quoted range.',
    },
  },
  {
    id: 'cl-northgate',
    name: 'Northgate Coaching',
    vertical: 'B2B sales coaching',
    onboardedOn: '2026-05-14',
    config: {
      industry: 'coaching',
      configuredFields: getIndustryTemplate('coaching').configuredFields,
      shiftStart: '10:00',
      shiftEnd: '19:00',
      timeZone: 'America/Denver',
      monthlyBookingQuota: 15,
      commissionPerBooking: 9,
      responseStandardMinutes: 15,
      escalationResponseHours: 8,
      escalationContact: null,
      qualifiedBookingDefinition:
        'A strategy call booked by an applicant who answered the qualifying questions and confirmed the time.',
    },
  },
  {
    id: 'cl-vance',
    name: 'Vance Plumbing & Heating',
    vertical: 'Residential trades',
    onboardedOn: '2026-07-09',
    config: {
      industry: 'home-services',
      configuredFields: getIndustryTemplate('home-services').configuredFields,
      shiftStart: '07:00',
      shiftEnd: '16:00',
      timeZone: 'America/Los_Angeles',
      monthlyBookingQuota: 12,
      commissionPerBooking: 7,
      responseStandardMinutes: 5,
      escalationResponseHours: 3,
      escalationContact: { name: 'Rae Vance', role: 'Owner', channel: 'WhatsApp' },
      qualifiedBookingDefinition:
        'An on-site estimate booked with an address, a job type, and an arrival window the customer confirmed.',
    },
  },
  {
    id: 'cl-solace',
    name: 'Solace Wellness',
    vertical: 'Med spa, single location',
    onboardedOn: '2026-02-24',
    config: {
      industry: 'med-spa',
      configuredFields: getIndustryTemplate('med-spa').configuredFields,
      shiftStart: '09:00',
      shiftEnd: '17:00',
      timeZone: 'America/New_York',
      monthlyBookingQuota: 16,
      commissionPerBooking: 6,
      responseStandardMinutes: 10,
      escalationResponseHours: 6,
      escalationContact: { name: 'Priya Raman', role: 'Practice manager', channel: 'Email' },
      qualifiedBookingDefinition: 'A consult booked with a confirmed time and a reachable phone number.',
    },
  },
];

const clientById = (id: string) => clients.find((client) => client.id === id)!;

// ---------------------------------------------------------------------------
// Placements
// ---------------------------------------------------------------------------

const placement = (
  id: string,
  operatorId: string,
  clientId: string,
  startDate: string,
  endDate: string,
  status: Placement['status'],
  extra: Partial<Placement> = {},
): Placement => {
  const config = clientById(clientId).config;
  return {
    id,
    operatorId,
    clientId,
    startDate,
    endDate,
    termMonths: 3,
    status,
    shiftStart: config.shiftStart,
    shiftEnd: config.shiftEnd,
    timeZone: config.timeZone,
    monthlyBookingQuota: config.monthlyBookingQuota,
    commissionPerBooking: config.commissionPerBooking,
    closedOn: null,
    renewedFromId: null,
    ...extra,
  };
};

const placements: Placement[] = [
  // Amara's first Lumen term, renewed rather than ended: history follows her.
  placement('pl-amara-lumen-1', 'op-amara', 'cl-lumen', '2026-03-15', '2026-06-15', 'renewed', {
    closedOn: '2026-06-14',
  }),
  placement('pl-amara-lumen-2', 'op-amara', 'cl-lumen', '2026-06-15', '2026-09-15', 'active', {
    renewedFromId: 'pl-amara-lumen-1',
  }),
  placement('pl-diego-brightline', 'op-diego', 'cl-brightline', '2026-06-01', '2026-09-01', 'active'),
  placement('pl-mei-northgate', 'op-mei', 'cl-northgate', '2026-05-18', '2026-08-18', 'active'),
  placement('pl-tomas-vance', 'op-tomas', 'cl-vance', '2026-07-13', '2026-10-13', 'active'),
  // Nadia's engagement ended; the case file and its logs stayed with Solace.
  placement('pl-nadia-solace', 'op-nadia', 'cl-solace', '2026-03-02', '2026-06-02', 'ended', {
    closedOn: '2026-06-02',
  }),
];

const activePlacements = placements.filter((item) => item.status === 'active');

// ---------------------------------------------------------------------------
// Response-time samples
// ---------------------------------------------------------------------------

/** Per-placement compliance profile: [monthlyFloor, monthlyCeiling, todayOverride]. */
const RESPONSE_PROFILE: Record<string, { low: number; high: number; today?: number }> = {
  'pl-amara-lumen-2': { low: 0.93, high: 0.99 },
  'pl-diego-brightline': { low: 0.78, high: 0.92, today: 0.68 },
  'pl-mei-northgate': { low: 0.9, high: 0.97 },
  'pl-tomas-vance': { low: 0.82, high: 0.93 },
  'pl-nadia-solace': { low: 0.88, high: 0.96 },
  'pl-amara-lumen-1': { low: 0.92, high: 0.98 },
};

function buildResponseDays(): ResponseDay[] {
  const out: ResponseDay[] = [];
  const random = rng(1337);

  for (const item of placements) {
    const profile = RESPONSE_PROFILE[item.id];
    const from = item.startDate;
    const to = item.closedOn ?? (Date.parse(item.endDate) < Date.parse(TODAY) ? item.endDate : TODAY);
    if (Date.parse(to) < Date.parse(from)) continue;

    for (const day of eachDay(from, to)) {
      const conversations = 8 + Math.floor(random() * 15);
      const target =
        day === TODAY && profile.today !== undefined
          ? profile.today
          : profile.low + random() * (profile.high - profile.low);
      out.push({
        placementId: item.id,
        date: day,
        conversations,
        withinStandard: Math.round(conversations * target),
      });
    }
  }

  return out;
}

const responseDays = buildResponseDays();

// ---------------------------------------------------------------------------
// EOD reports
// ---------------------------------------------------------------------------

/** Deliberate gaps, so missed-EOD flags in the demo are intentional. */
const EOD_GAPS: Record<string, string[]> = {
  'pl-diego-brightline': [YESTERDAY, '2026-07-18'],
  'pl-mei-northgate': ['2026-07-11'],
  'pl-tomas-vance': [],
  'pl-amara-lumen-2': [],
};

function configuredValues(clientId: string, random: () => number): Record<string, string | number | boolean> {
  const fields = clientById(clientId).config.configuredFields;
  const out: Record<string, string | number | boolean> = {};
  for (const field of fields) {
    if (field.type === 'number') out[field.key] = Math.floor(random() * 6);
    else if (field.type === 'boolean') out[field.key] = random() > 0.5;
    else if (field.type === 'select' && field.options) out[field.key] = pick(random, field.options);
    else out[field.key] = '';
  }
  return out;
}

const BLOCKERS = [
  '',
  '',
  '',
  'Client calendar was double-booked for two afternoon slots.',
  'Two inbound numbers went to voicemail with no callback listed.',
  'CRM was slow to load for about forty minutes mid-shift.',
];

const NOTES = [
  'Steady shift, nothing unusual.',
  'Two customers asked about weekend availability we do not currently offer.',
  'Follow-up sequence is landing well; three replies from last week reactivated.',
  'One caller asked for a service we do not list. Logged as a scope question.',
  'Quiet morning, busy last two hours.',
];

function buildEodReports(): EodReport[] {
  const out: EodReport[] = [];
  const random = rng(4242);

  for (const item of placements) {
    const gaps = new Set(EOD_GAPS[item.id] ?? []);
    const from = Date.parse(item.startDate) > Date.parse('2026-06-01') ? item.startDate : '2026-06-01';
    const rawTo = item.closedOn ?? item.endDate;
    const to = Date.parse(rawTo) < Date.parse(YESTERDAY) ? rawTo : YESTERDAY;
    if (Date.parse(to) < Date.parse(from)) continue;

    for (const day of eachDay(from, to)) {
      if (gaps.has(day)) continue;

      const conversations = 8 + Math.floor(random() * 15);
      const booked = Math.min(conversations, Math.floor(random() * 4));

      out.push({
        id: `eod-${item.id}-${day}`,
        placementId: item.id,
        operatorId: item.operatorId,
        shiftDate: day,
        submittedAt: `${day}T${18 + Math.floor(random() * 2)}:${String(10 + Math.floor(random() * 45)).padStart(2, '0')}:00.000Z`,
        core: {
          shiftStartActual: item.shiftStart,
          shiftEndActual: item.shiftEnd,
          conversationsHandled: conversations,
          appointmentsBooked: booked,
          followUpsCompleted: Math.floor(random() * 12),
          escalationsRaised: random() > 0.88 ? 1 : 0,
          blockers: pick(random, BLOCKERS),
          notes: pick(random, NOTES),
        },
        configured: configuredValues(item.clientId, random),
        version: 1,
        supersededById: null,
        correctionReason: null,
        adminComments: [],
      });
    }
  }

  // A correction pair, so the immutability rule is visible in the case file.
  const original = out.find((report) => report.id === 'eod-pl-amara-lumen-2-2026-07-21');
  if (original) {
    const correctionId = `${original.id}-v2`;
    original.supersededById = correctionId;
    out.push({
      ...original,
      id: correctionId,
      version: 2,
      submittedAt: '2026-07-22T09:14:00.000Z',
      supersededById: null,
      correctionReason: 'Undercounted follow-ups — two sequences were sent after I filed the report.',
      core: { ...original.core, followUpsCompleted: original.core.followUpsCompleted + 2 },
      adminComments: [
        {
          id: 'cmt-1',
          authorName: 'DA Admin',
          body: 'Noted, thanks for correcting it rather than leaving it. Original version stays on file.',
          createdAt: '2026-07-22T12:02:00.000Z',
        },
      ],
    });
  }

  const diegoReport = out.find((report) => report.id === 'eod-pl-diego-brightline-2026-07-24');
  if (diegoReport) {
    diegoReport.adminComments.push({
      id: 'cmt-2',
      authorName: 'DA Admin',
      body: 'Response times slipped on the afternoon block. Walk me through what happened on our next check-in.',
      createdAt: '2026-07-25T08:30:00.000Z',
    });
  }

  return out;
}

const eodReports = buildEodReports();

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/**
 * Per-placement booking mix for the current month. `matched` pairs appear in
 * both sources, `systemOnly` came from GHL alone, `claims` are manual entries
 * with no ingested counterpart.
 */
const BOOKING_MIX: Record<string, { matched: number; systemOnly: number; claims: number }> = {
  'pl-amara-lumen-2': { matched: 17, systemOnly: 7, claims: 1 },
  'pl-diego-brightline': { matched: 9, systemOnly: 3, claims: 3 },
  'pl-mei-northgate': { matched: 7, systemOnly: 2, claims: 2 },
  'pl-tomas-vance': { matched: 5, systemOnly: 1, claims: 1 },
};

const CLAIM_NOTES = [
  'Booked over the phone while the CRM was down. Customer confirmed the time verbally.',
  'Walk-in who called back directly on the owner\u2019s line, never hit the tracked number.',
  'Webhook looked like it failed — the appointment is on the client calendar.',
  'Rescheduled from a cancelled slot; the original event did not carry over.',
];

function buildBookings(): Booking[] {
  const out: Booking[] = [];
  const random = rng(90210);
  let counter = 0;

  const monthWindow = (item: Placement, month: string) => {
    const start = month === monthKey(item.startDate) ? item.startDate : `${month}-01`;
    const cap = Date.parse(TODAY) < Date.parse(`${month}-28`) ? TODAY : `${month}-28`;
    return eachDay(start, cap);
  };

  const emit = (
    item: Placement,
    month: string,
    counts: { matched: number; systemOnly: number; claims: number },
  ) => {
    const days = monthWindow(item, month);
    if (days.length === 0) return;

    const slot = (index: number) => {
      const day = days[index % days.length];
      const hour = 9 + Math.floor(random() * 8);
      return `${day}T${String(hour).padStart(2, '0')}:${random() > 0.5 ? '30' : '00'}:00.000Z`;
    };

    for (let index = 0; index < counts.matched; index += 1) {
      counter += 1;
      const person = customer(random, counter);
      const scheduledFor = slot(index * 2);
      const ghlId = `bk-${item.id}-${month}-ghl-${index}`;
      out.push({
        id: ghlId,
        placementId: item.id,
        operatorId: item.operatorId,
        clientId: item.clientId,
        scheduledFor,
        recordedAt: scheduledFor,
        source: 'ghl',
        state: 'confirmed',
        customerName: person.name,
        customerPhone: person.phone,
        customerEmail: person.email,
        matchedBookingId: null,
        operatorNote: null,
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        qualified: true,
      });
      out.push({
        id: `bk-${item.id}-${month}-man-${index}`,
        placementId: item.id,
        operatorId: item.operatorId,
        clientId: item.clientId,
        scheduledFor,
        recordedAt: scheduledFor,
        source: 'manual',
        state: 'confirmed',
        customerName: person.name,
        customerPhone: person.phone,
        customerEmail: null,
        matchedBookingId: ghlId,
        operatorNote: null,
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        qualified: true,
      });
    }

    for (let index = 0; index < counts.systemOnly; index += 1) {
      counter += 1;
      const person = customer(random, counter);
      const scheduledFor = slot(index * 3 + 1);
      out.push({
        id: `bk-${item.id}-${month}-sys-${index}`,
        placementId: item.id,
        operatorId: item.operatorId,
        clientId: item.clientId,
        scheduledFor,
        recordedAt: scheduledFor,
        source: 'ghl',
        state: 'system-only',
        customerName: person.name,
        customerPhone: person.phone,
        customerEmail: person.email,
        matchedBookingId: null,
        operatorNote: null,
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        qualified: true,
      });
    }

    for (let index = 0; index < counts.claims; index += 1) {
      counter += 1;
      const person = customer(random, counter);
      const scheduledFor = slot(index * 5 + 2);
      out.push({
        id: `bk-${item.id}-${month}-claim-${index}`,
        placementId: item.id,
        operatorId: item.operatorId,
        clientId: item.clientId,
        scheduledFor,
        recordedAt: scheduledFor,
        source: 'manual',
        state: 'pending-review',
        customerName: person.name,
        customerPhone: person.phone,
        customerEmail: null,
        matchedBookingId: null,
        operatorNote: pick(random, CLAIM_NOTES),
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        qualified: true,
      });
    }
  };

  for (const item of activePlacements) {
    const mix = BOOKING_MIX[item.id];
    if (!mix) continue;
    emit(item, '2026-07', mix);
    // A lighter June, so pay history has something behind it.
    if (Date.parse(item.startDate) <= Date.parse('2026-06-15')) {
      emit(item, '2026-06', {
        matched: Math.max(0, mix.matched - 3),
        systemOnly: Math.max(0, mix.systemOnly - 2),
        claims: 0,
      });
    }
  }

  emit(placements.find((item) => item.id === 'pl-nadia-solace')!, '2026-06', {
    matched: 0,
    systemOnly: 0,
    claims: 0,
  });

  // A rejected claim, so the profile shows the pattern the admin watches for.
  out.push({
    id: 'bk-pl-diego-brightline-2026-06-claim-rejected',
    placementId: 'pl-diego-brightline',
    operatorId: 'op-diego',
    clientId: 'cl-brightline',
    scheduledFor: '2026-06-24T15:00:00.000Z',
    recordedAt: '2026-06-24T16:20:00.000Z',
    source: 'manual',
    state: 'rejected',
    customerName: 'Marcus Blake',
    customerPhone: '+1 312 555 0148',
    customerEmail: null,
    matchedBookingId: null,
    operatorNote: 'Customer said they would call the office to confirm a time.',
    reviewedBy: 'DA Admin',
    reviewedAt: '2026-06-25T13:05:00.000Z',
    rejectionReason: 'No appointment on the client calendar and no confirmed time. An intent to call is not a booking.',
    qualified: false,
  });

  // Run the real reconciler so seeded states cannot contradict the rules.
  const byPlacement = new Map<string, Booking[]>();
  for (const booking of out) {
    const bucket = byPlacement.get(booking.placementId) ?? [];
    bucket.push(booking);
    byPlacement.set(booking.placementId, bucket);
  }
  return [...byPlacement.values()].flatMap((bucket) => reconcilePlacement(bucket));
}

const bookings = buildBookings();

// ---------------------------------------------------------------------------
// Escalations
// ---------------------------------------------------------------------------

const escalations: Escalation[] = [
  {
    id: 'esc-1',
    placementId: 'pl-diego-brightline',
    operatorId: 'op-diego',
    clientId: 'cl-brightline',
    category: 'pricing-exception',
    customerContext:
      'Four-bedroom in Oak Park asking for fortnightly service at the weekly rate because they are a returning customer from 2024.',
    needed: 'Can I honour the old rate, or hold the current price list?',
    status: 'open',
    raisedAt: '2026-07-25T14:10:00.000Z',
    responseDueAt: '2026-07-25T20:10:00.000Z',
    answeredAt: null,
    answer: null,
    answeredBy: null,
    closedAt: null,
    routedTo: ['DA Admin', 'Owen Pratt'],
  },
  {
    id: 'esc-2',
    placementId: 'pl-mei-northgate',
    operatorId: 'op-mei',
    clientId: 'cl-northgate',
    category: 'scope',
    customerContext:
      'Applicant runs an agency with eleven staff and is asking whether there is a team programme rather than a one-to-one track.',
    needed: 'Is there a team offer I should be booking these into, or do I disqualify?',
    status: 'open',
    raisedAt: '2026-07-26T16:05:00.000Z',
    responseDueAt: '2026-07-27T00:05:00.000Z',
    answeredAt: null,
    answer: null,
    answeredBy: null,
    closedAt: null,
    routedTo: ['DA Admin'],
  },
  {
    id: 'esc-3',
    placementId: 'pl-amara-lumen-2',
    operatorId: 'op-amara',
    clientId: 'cl-lumen',
    category: 'clinical',
    customerContext:
      'Customer on a blood thinner asking whether injectables are safe for her. I did not answer and told her a clinician would confirm.',
    needed: 'Clinical sign-off before I book the consult.',
    status: 'answered',
    raisedAt: '2026-07-23T11:20:00.000Z',
    responseDueAt: '2026-07-23T15:20:00.000Z',
    answeredAt: '2026-07-23T13:40:00.000Z',
    answer:
      'Correct call, never answer that yourself. Book the consult and flag it for Dr. Vos to screen at intake. Use the medication disclosure script.',
    answeredBy: 'DA Admin',
    closedAt: null,
    routedTo: ['DA Admin', 'Dr. Renata Vos'],
  },
  {
    id: 'esc-4',
    placementId: 'pl-tomas-vance',
    operatorId: 'op-tomas',
    clientId: 'cl-vance',
    category: 'complaint',
    customerContext: 'Customer waited two days for a callback on a leak and is asking for a discount.',
    needed: 'How do I handle the discount request?',
    status: 'closed',
    raisedAt: '2026-07-18T17:45:00.000Z',
    responseDueAt: '2026-07-18T20:45:00.000Z',
    answeredAt: '2026-07-18T18:30:00.000Z',
    answer:
      'Apologise, book the earliest slot, do not offer money. Rae decides on goodwill credits, not us. Script added to the playbook.',
    answeredBy: 'DA Admin',
    closedAt: '2026-07-19T09:00:00.000Z',
    routedTo: ['DA Admin', 'Rae Vance'],
  },
  {
    id: 'esc-5',
    placementId: 'pl-amara-lumen-2',
    operatorId: 'op-amara',
    clientId: 'cl-lumen',
    category: 'clinical',
    customerContext: 'Second customer this month asking about injectables while on medication.',
    needed: 'Is there a standing script for this yet?',
    status: 'closed',
    raisedAt: '2026-07-09T10:05:00.000Z',
    responseDueAt: '2026-07-09T14:05:00.000Z',
    answeredAt: '2026-07-09T11:15:00.000Z',
    answer:
      'Third time this has come up, so it is a missing script rather than an operator problem. Medication disclosure script is now in the Lumen playbook.',
    answeredBy: 'DA Admin',
    closedAt: '2026-07-09T11:20:00.000Z',
    routedTo: ['DA Admin', 'Dr. Renata Vos'],
  },
];

// ---------------------------------------------------------------------------
// Scope requests, notes, evidence
// ---------------------------------------------------------------------------

const scopeRequests: ScopeRequest[] = [
  {
    id: 'scope-1',
    clientId: 'cl-brightline',
    placementId: 'pl-diego-brightline',
    requestedBy: 'Owen Pratt',
    summary: 'Add outbound reactivation to the shift',
    detail:
      'Client wants the operator to work a list of 2024 customers alongside inbound. That is additional scope against the current placement.',
    status: 'open',
    createdAt: '2026-07-22T09:30:00.000Z',
    resolvedAt: null,
    resolution: null,
  },
  {
    id: 'scope-2',
    clientId: 'cl-lumen',
    placementId: 'pl-amara-lumen-2',
    requestedBy: 'Dr. Renata Vos',
    summary: 'Saturday coverage for the Midtown location',
    detail: 'Requested a half-day Saturday shift for the third location.',
    status: 'approved',
    createdAt: '2026-06-28T13:00:00.000Z',
    resolvedAt: '2026-07-01T10:00:00.000Z',
    resolution: 'Approved as a term amendment with the quota raised from 18 to 20 and the base adjusted accordingly.',
  },
  {
    id: 'scope-3',
    clientId: 'cl-northgate',
    placementId: 'pl-mei-northgate',
    requestedBy: 'Mei Ling Tan',
    summary: 'Team programme offer for multi-seat applicants',
    detail: 'Recurring question from agency applicants. No offer exists to book them into.',
    status: 'open',
    createdAt: '2026-07-26T16:10:00.000Z',
    resolvedAt: null,
    resolution: null,
  },
];

const adminNotes: AdminNote[] = [
  {
    id: 'note-1',
    clientId: 'cl-brightline',
    placementId: 'pl-diego-brightline',
    authorName: 'DA Admin',
    body: 'Diego is strong on rapport but the afternoon response block is slipping. Watching the next five shifts before deciding on a tier review.',
    createdAt: '2026-07-25T09:00:00.000Z',
  },
  {
    id: 'note-2',
    clientId: 'cl-lumen',
    placementId: 'pl-amara-lumen-2',
    authorName: 'DA Admin',
    body: 'Renewed for a second term. Client asked for Amara by name, which is the outcome we want the bench to produce.',
    createdAt: '2026-06-15T08:20:00.000Z',
  },
  {
    id: 'note-3',
    clientId: 'cl-solace',
    placementId: null,
    authorName: 'DA Admin',
    body: 'Engagement ended when Solace paused marketing spend. Case file kept intact for a future re-open. Nadia moved to the bench.',
    createdAt: '2026-06-02T15:40:00.000Z',
  },
];

const evidence: Evidence[] = [
  { id: 'ev-1', clientId: 'cl-lumen', placementId: 'pl-amara-lumen-2', label: 'Calendar export — week of 20 Jul', kind: 'screenshot', uploadedBy: 'Amara Ochieng', uploadedAt: '2026-07-25T18:20:00.000Z', sizeLabel: '412 KB' },
  { id: 'ev-2', clientId: 'cl-lumen', placementId: 'pl-amara-lumen-2', label: 'Medication disclosure script confirmation', kind: 'document', uploadedBy: 'DA Admin', uploadedAt: '2026-07-09T11:25:00.000Z', sizeLabel: '88 KB' },
  { id: 'ev-3', clientId: 'cl-brightline', placementId: 'pl-diego-brightline', label: 'Phone booking recording — Oak Park', kind: 'recording', uploadedBy: 'Diego Salcedo', uploadedAt: '2026-07-24T20:05:00.000Z', sizeLabel: '2.1 MB' },
  { id: 'ev-4', clientId: 'cl-brightline', placementId: 'pl-diego-brightline', label: 'CRM outage transcript', kind: 'transcript', uploadedBy: 'Diego Salcedo', uploadedAt: '2026-07-19T14:40:00.000Z', sizeLabel: '36 KB' },
  { id: 'ev-5', clientId: 'cl-northgate', placementId: 'pl-mei-northgate', label: 'Application review sample — 24 Jul', kind: 'document', uploadedBy: 'Mei Ling Tan', uploadedAt: '2026-07-24T19:10:00.000Z', sizeLabel: '154 KB' },
];

// ---------------------------------------------------------------------------
// Tasks and notifications
// ---------------------------------------------------------------------------

const tasks: OperatorTask[] = [
  { id: 'task-1', operatorId: 'op-diego', placementId: 'pl-diego-brightline', title: 'File the missed EOD for 25 Jul', detail: 'Backfill it with the actual numbers and note why it was late.', dueOn: '2026-07-27', completedOn: null, assignedBy: 'DA Admin' },
  { id: 'task-2', operatorId: 'op-diego', placementId: 'pl-diego-brightline', title: 'Review the afternoon response block', detail: 'Watch your first-touch times between 13:00 and 16:00 and tell me what is getting in the way.', dueOn: '2026-07-28', completedOn: null, assignedBy: 'DA Admin' },
  { id: 'task-3', operatorId: 'op-mei', placementId: 'pl-mei-northgate', title: 'Push follow-ups on last week\u2019s applications', detail: 'Nine confirmed against a quota of fifteen with five days left. Work the unresponded applications first.', dueOn: '2026-07-29', completedOn: null, assignedBy: 'DA Admin' },
  { id: 'task-4', operatorId: 'op-amara', placementId: 'pl-amara-lumen-2', title: 'Brief the Saturday Midtown coverage', detail: 'Walk me through how you want to split the Saturday half-day.', dueOn: '2026-07-30', completedOn: null, assignedBy: 'DA Admin' },
  { id: 'task-5', operatorId: 'op-tomas', placementId: 'pl-tomas-vance', title: 'Confirm arrival-window language', detail: 'Use the two-hour window script, never a fixed time.', dueOn: '2026-07-24', completedOn: '2026-07-23', assignedBy: 'DA Admin' },
  { id: 'task-6', operatorId: 'op-nadia', placementId: null, title: 'Finish the med spa consult refresher', detail: 'Needed before the next med spa placement opens.', dueOn: '2026-08-01', completedOn: null, assignedBy: 'DA Admin' },
];

const notifications: Notification[] = [
  {
    id: 'ntf-1',
    operatorId: 'op-diego',
    severity: 'urgent',
    title: 'Missed EOD for 25 Jul',
    body: 'No end-of-day report was filed for your Brightline shift. File it today and note why it was late.',
    createdAt: '2026-07-26T07:00:00.000Z',
    readAt: null,
    sentBy: 'System',
    relatedPlacementId: 'pl-diego-brightline',
    attempts: [
      { channel: 'in-app', status: 'delivered', attemptedAt: '2026-07-26T07:00:01.000Z', detail: null },
      { channel: 'discord', status: 'failed', attemptedAt: '2026-07-26T07:00:02.000Z', detail: 'Webhook returned 503.' },
      { channel: 'email', status: 'delivered', attemptedAt: '2026-07-26T07:00:04.000Z', detail: null },
      { channel: 'whatsapp', status: 'delivered', attemptedAt: '2026-07-26T07:00:06.000Z', detail: null },
    ],
  },
  {
    id: 'ntf-2',
    operatorId: 'op-diego',
    severity: 'important',
    title: 'Response compliance below standard',
    body: 'You are at 68% inside the 10-minute window today. The standard is 90%.',
    createdAt: '2026-07-26T15:30:00.000Z',
    readAt: null,
    sentBy: 'System',
    relatedPlacementId: 'pl-diego-brightline',
    attempts: [
      { channel: 'discord', status: 'delivered', attemptedAt: '2026-07-26T15:30:01.000Z', detail: 'Preferred channel.' },
      { channel: 'in-app', status: 'delivered', attemptedAt: '2026-07-26T15:30:02.000Z', detail: null },
      { channel: 'email', status: 'delivered', attemptedAt: '2026-07-26T15:30:03.000Z', detail: null },
      { channel: 'whatsapp', status: 'skipped', attemptedAt: '2026-07-26T15:30:03.000Z', detail: 'Not routed for important severity.' },
    ],
  },
  {
    id: 'ntf-3',
    operatorId: 'op-mei',
    severity: 'important',
    title: 'Quota warning',
    body: '9 of 15 confirmed with 5 days left in the period. Commission starts above 15.',
    createdAt: '2026-07-26T09:15:00.000Z',
    readAt: '2026-07-26T09:40:00.000Z',
    sentBy: 'System',
    relatedPlacementId: 'pl-mei-northgate',
    attempts: [
      { channel: 'email', status: 'delivered', attemptedAt: '2026-07-26T09:15:01.000Z', detail: 'Preferred channel.' },
      { channel: 'in-app', status: 'delivered', attemptedAt: '2026-07-26T09:15:02.000Z', detail: null },
      { channel: 'discord', status: 'delivered', attemptedAt: '2026-07-26T09:15:03.000Z', detail: null },
      { channel: 'whatsapp', status: 'skipped', attemptedAt: '2026-07-26T09:15:03.000Z', detail: 'Not routed for important severity.' },
    ],
  },
  {
    id: 'ntf-4',
    operatorId: 'op-amara',
    severity: 'informational',
    title: 'Comment on your 21 Jul EOD',
    body: 'Noted, thanks for correcting it rather than leaving it. Original version stays on file.',
    createdAt: '2026-07-22T12:02:00.000Z',
    readAt: '2026-07-22T12:30:00.000Z',
    sentBy: 'DA Admin',
    relatedPlacementId: 'pl-amara-lumen-2',
    attempts: [
      { channel: 'in-app', status: 'delivered', attemptedAt: '2026-07-22T12:02:01.000Z', detail: null },
      { channel: 'discord', status: 'delivered', attemptedAt: '2026-07-22T12:02:02.000Z', detail: null },
      { channel: 'email', status: 'skipped', attemptedAt: '2026-07-22T12:02:02.000Z', detail: 'Not routed for informational severity.' },
      { channel: 'whatsapp', status: 'skipped', attemptedAt: '2026-07-22T12:02:02.000Z', detail: 'Not routed for informational severity.' },
    ],
  },
  {
    id: 'ntf-5',
    operatorId: 'op-tomas',
    severity: 'informational',
    title: 'Task assigned: confirm arrival-window language',
    body: 'Use the two-hour window script, never a fixed time.',
    createdAt: '2026-07-22T08:00:00.000Z',
    readAt: '2026-07-22T08:12:00.000Z',
    sentBy: 'DA Admin',
    relatedPlacementId: 'pl-tomas-vance',
    attempts: [
      { channel: 'in-app', status: 'delivered', attemptedAt: '2026-07-22T08:00:01.000Z', detail: 'Preferred channel.' },
      { channel: 'discord', status: 'delivered', attemptedAt: '2026-07-22T08:00:02.000Z', detail: null },
      { channel: 'email', status: 'skipped', attemptedAt: '2026-07-22T08:00:02.000Z', detail: 'Not routed for informational severity.' },
      { channel: 'whatsapp', status: 'skipped', attemptedAt: '2026-07-22T08:00:02.000Z', detail: 'Not routed for informational severity.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Pay periods and statements
// ---------------------------------------------------------------------------

const payPeriods: PayPeriod[] = [
  { id: 'pp-2026-06-a', start: '2026-06-01', end: '2026-06-15', closesMonth: false, status: 'closed', closedAt: '2026-06-17T12:00:00.000Z' },
  { id: 'pp-2026-06-b', start: '2026-06-16', end: '2026-06-30', closesMonth: true, status: 'closed', closedAt: '2026-07-02T12:00:00.000Z' },
  { id: 'pp-2026-07-a', start: '2026-07-01', end: '2026-07-15', closesMonth: false, status: 'closed', closedAt: '2026-07-17T12:00:00.000Z' },
  { id: 'pp-2026-07-b', start: '2026-07-16', end: '2026-07-31', closesMonth: true, status: 'open', closedAt: null },
];

const SEEDED_ADJUSTMENTS = [
  {
    statementId: 'stmt-pl-diego-brightline-pp-2026-07-a',
    id: 'adj-1',
    label: 'Equipment stipend',
    reason: 'Replacement headset approved after the June call-quality complaint.',
    amount: 45,
    addedBy: 'DA Admin',
    addedAt: '2026-07-16T10:00:00.000Z',
  },
  {
    statementId: 'stmt-pl-mei-northgate-pp-2026-06-b',
    id: 'adj-2',
    label: 'Unapproved absence',
    reason: 'Two shifts missed on 22 and 23 Jun with no notice.',
    amount: -32,
    addedBy: 'DA Admin',
    addedAt: '2026-07-01T09:20:00.000Z',
  },
];

/** Statements are computed with the real pay rules, then locked if the period closed. */
function buildStatements(): PayStatement[] {
  const out: PayStatement[] = [];

  for (const period of payPeriods) {
    for (const item of placements) {
      const operator = operators.find((candidate) => candidate.id === item.operatorId);
      if (!operator) continue;

      const placementEnd = item.closedOn ?? item.endDate;
      const overlaps =
        Date.parse(item.startDate) <= Date.parse(period.end) &&
        Date.parse(placementEnd) >= Date.parse(period.start);
      if (!overlaps) continue;

      const statementId = `stmt-${item.id}-${period.id}`;
      const adjustments = SEEDED_ADJUSTMENTS.filter(
        (adjustment) => adjustment.statementId === statementId,
      );

      const statement = computeStatement({
        operator,
        placement: item,
        period,
        bookingsForPlacement: bookings.filter((booking) => booking.placementId === item.id),
        responseDays,
        adjustments,
      });

      out.push(period.status === 'closed' ? lockStatement(statement, period.closedAt!) : statement);
    }
  }

  return out;
}

const payStatements = buildStatements();

// ---------------------------------------------------------------------------

export function createSeedData(): OpsData {
  return {
    operators: structuredClone(operators),
    clients: structuredClone(clients),
    placements: structuredClone(placements),
    eodReports: structuredClone(eodReports),
    bookings: structuredClone(bookings),
    escalations: structuredClone(escalations),
    scopeRequests: structuredClone(scopeRequests),
    adminNotes: structuredClone(adminNotes),
    evidence: structuredClone(evidence),
    notifications: structuredClone(notifications),
    tasks: structuredClone(tasks),
    payPeriods: structuredClone(payPeriods),
    payStatements: structuredClone(payStatements),
    responseDays: structuredClone(responseDays),
    now: NOW,
  };
}
