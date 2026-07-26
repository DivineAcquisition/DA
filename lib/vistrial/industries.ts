import type { EodConfiguredField, EodFieldType, IndustryId } from './types';

/**
 * The locked EOD core. These fields exist on every report for every client in
 * every industry. They are deliberately not configurable: cross-operator
 * reporting is only possible while every operator answers the same questions.
 */
export const EOD_CORE_FIELDS = [
  { key: 'shiftStartActual', label: 'Shift start (actual)', type: 'text' as EodFieldType },
  { key: 'shiftEndActual', label: 'Shift end (actual)', type: 'text' as EodFieldType },
  { key: 'conversationsHandled', label: 'Leads / conversations handled', type: 'number' as EodFieldType },
  { key: 'appointmentsBooked', label: 'Appointments booked', type: 'number' as EodFieldType },
  { key: 'followUpsCompleted', label: 'Follow-ups completed', type: 'number' as EodFieldType },
  { key: 'escalationsRaised', label: 'Escalations raised', type: 'number' as EodFieldType },
  { key: 'blockers', label: 'Blockers', type: 'text' as EodFieldType },
  { key: 'notes', label: 'Notes', type: 'text' as EodFieldType },
] as const;

export const CORE_FIELD_KEYS: readonly string[] = EOD_CORE_FIELDS.map((field) => field.key);

export type IndustryTemplate = {
  id: IndustryId;
  name: string;
  description: string;
  configuredFields: EodConfiguredField[];
  suggestedQualifiedBooking: string;
};

/**
 * Starting points, not constraints. Every template can be overridden per client
 * in the case file; only the core resists editing.
 */
export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: 'med-spa',
    name: 'Med spa / aesthetics',
    description: 'Consult-led bookings with treatment interest worth tracking per shift.',
    suggestedQualifiedBooking:
      'A consult booked with a confirmed time, a named treatment interest, and a reachable phone number.',
    configuredFields: [
      { key: 'consultsBooked', label: 'Consults booked', type: 'number', required: true },
      {
        key: 'treatmentInterest',
        label: 'Primary treatment interest',
        type: 'select',
        options: ['Injectables', 'Laser', 'Body contouring', 'Skin / facials', 'Mixed', 'None stated'],
        required: true,
      },
      { key: 'preTreatmentQuestions', label: 'Pre-treatment questions deferred to clinical', type: 'number', required: false, help: 'Anything you routed to the clinical team rather than answering.' },
    ],
  },
  {
    id: 'cleaning',
    name: 'Cleaning / recurring service',
    description: 'Quote-led bookings where service type and recurrence drive the value.',
    suggestedQualifiedBooking:
      'A walkthrough or first clean scheduled with an address, a service type, and a quoted range.',
    configuredFields: [
      { key: 'quotesSent', label: 'Quotes sent', type: 'number', required: true },
      {
        key: 'serviceType',
        label: 'Dominant service type',
        type: 'select',
        options: ['Recurring residential', 'One-off deep clean', 'Move in / move out', 'Commercial'],
        required: true,
      },
      { key: 'recurringInterest', label: 'Asked about recurring service', type: 'boolean', required: false },
    ],
  },
  {
    id: 'coaching',
    name: 'Coaching / info',
    description: 'Application-led bookings where show rate is the number that matters.',
    suggestedQualifiedBooking:
      'A strategy call booked by an applicant who answered the qualifying questions and confirmed the time.',
    configuredFields: [
      { key: 'applicationsReviewed', label: 'Applications reviewed', type: 'number', required: true },
      { key: 'showRate', label: 'Show rate on today\u2019s calls (%)', type: 'number', required: true },
      { key: 'disqualified', label: 'Disqualified on fit', type: 'number', required: false, help: 'Applicants you turned away rather than booked.' },
    ],
  },
  {
    id: 'home-services',
    name: 'Home services / trades',
    description: 'Dispatch-led bookings where job type and urgency drive routing.',
    suggestedQualifiedBooking:
      'An on-site estimate booked with an address, a job type, and an arrival window the customer confirmed.',
    configuredFields: [
      { key: 'estimatesBooked', label: 'On-site estimates booked', type: 'number', required: true },
      {
        key: 'jobType',
        label: 'Dominant job type',
        type: 'select',
        options: ['Repair', 'Replacement', 'Maintenance plan', 'Emergency'],
        required: true,
      },
      { key: 'emergencyCalls', label: 'Emergency calls routed', type: 'number', required: false },
    ],
  },
  {
    id: 'generic',
    name: 'Generic service business',
    description: 'Core only, for clients that do not need industry-specific reporting yet.',
    suggestedQualifiedBooking: 'An appointment with a confirmed time and a reachable contact method.',
    configuredFields: [],
  },
];

export const getIndustryTemplate = (id: IndustryId) =>
  INDUSTRY_TEMPLATES.find((template) => template.id === id) ?? INDUSTRY_TEMPLATES[INDUSTRY_TEMPLATES.length - 1];

export const industryName = (id: IndustryId) => getIndustryTemplate(id).name;
