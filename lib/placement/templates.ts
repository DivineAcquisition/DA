/** Vertical templates. They prefill the wizard and never create a placement. */

export type PlacementOutcome = { name: string; definition: string };

export type PlacementTemplate = {
  slug: string;
  name: string;
  vertical: string;
  speedTracked: boolean;
  categories: Array<'outbound_calling' | 'follow_up' | 'reactivation'>;
  outcomes: PlacementOutcome[];
  offerOutline: Record<string, string>;
  ghl: { calendars: string[]; stage: string | null; tag: string | null };
  firstDay: string[];
  report: { sendDow: number; sendTime: string; daily: boolean; approval: boolean; ccManager: boolean };
};

export const FIRST_DAY_TASKS = [
  "Sign in to [client]'s GHL with your own user and confirm your phone number works.",
  'Read the offer brief on your client card.',
  'Review what counts as a win.',
  'Log your first conversation with quick log.',
  'Submit your first EOD by [deadline].',
];

const OFFER_OUTLINE = {
  one_liner: 'What the business does, in one sentence the operator can say out loud.',
  service_area: 'Cities, neighborhoods, or the area they book.',
  prices: 'Services and the price ranges the operator may quote. Leave blank if they should not quote.',
  ideal_customer: 'Who a good booking is for.',
  objections: 'The objections that come up, and the approved answer for each.',
  booking_rules: 'Who to book, how far out, and what to collect before the appointment is real.',
  never: 'What the operator must not promise or do.',
  escalate: 'When to stop and hand the conversation to the client.',
};

const REPORT = { sendDow: 1, sendTime: '09:00', daily: false, approval: true, ccManager: true };

export const PLACEMENT_TEMPLATES: PlacementTemplate[] = [
  {
    slug: 'cleaning',
    name: 'Cleaning',
    vertical: 'Cleaning (residential and commercial)',
    speedTracked: true,
    categories: ['outbound_calling', 'follow_up', 'reactivation'],
    outcomes: [
      { name: 'Cleaning booked', definition: 'A first clean scheduled with a confirmed date.' },
      { name: 'Walkthrough booked', definition: 'An in-person or video walkthrough scheduled for a larger home or commercial space.' },
      { name: 'Recurring plan booked', definition: 'A weekly, biweekly, or monthly recurring service set up with a start date.' },
    ],
    offerOutline: OFFER_OUTLINE,
    ghl: { calendars: ['First Clean', 'Walkthrough'], stage: 'Recurring Plan Booked', tag: 'reactivation-list' },
    firstDay: FIRST_DAY_TASKS,
    report: REPORT,
  },
  {
    slug: 'home_services',
    name: 'Home Services',
    vertical: 'Home Services',
    speedTracked: true,
    categories: ['outbound_calling', 'follow_up', 'reactivation'],
    outcomes: [
      { name: 'Estimate booked', definition: 'An on-site or virtual estimate scheduled.' },
      { name: 'Job booked', definition: 'A job scheduled with a confirmed date.' },
      { name: 'Maintenance plan sold', definition: 'A recurring service plan agreed.' },
    ],
    offerOutline: OFFER_OUTLINE,
    ghl: { calendars: ['Estimate', 'Job'], stage: 'Maintenance Plan', tag: 'reactivation-list' },
    firstDay: FIRST_DAY_TASKS,
    report: REPORT,
  },
  {
    slug: 'med_spa',
    name: 'Med Spa',
    vertical: 'Med Spa',
    speedTracked: true,
    categories: ['outbound_calling', 'follow_up', 'reactivation'],
    outcomes: [
      { name: 'Consultation booked', definition: 'A consult scheduled with a provider.' },
      { name: 'Treatment booked', definition: 'A paid treatment scheduled.' },
      { name: 'Membership sold', definition: 'A recurring membership agreed.' },
    ],
    offerOutline: OFFER_OUTLINE,
    ghl: { calendars: ['Consultation', 'Treatment'], stage: 'Membership', tag: 'reactivation-list' },
    firstDay: FIRST_DAY_TASKS,
    report: REPORT,
  },
  {
    slug: 'coaches',
    name: 'Coaches and Consultants',
    vertical: 'Coaches and Consultants',
    speedTracked: true,
    categories: ['outbound_calling', 'follow_up'],
    outcomes: [
      { name: 'Discovery call booked', definition: 'A first call scheduled.' },
      { name: 'Strategy call booked', definition: 'A sales call with the coach scheduled.' },
      { name: 'Enrollment', definition: 'A client paid or signed.' },
    ],
    offerOutline: OFFER_OUTLINE,
    ghl: { calendars: ['Discovery Call', 'Strategy Call'], stage: 'Enrolled', tag: null },
    firstDay: FIRST_DAY_TASKS,
    report: REPORT,
  },
];

export function templateBySlug(slug: string | null | undefined): PlacementTemplate | null {
  return PLACEMENT_TEMPLATES.find((template) => template.slug === slug) ?? null;
}

export function fillTask(task: string, client: string, deadline: string): string {
  return task.replaceAll('[client]', client || 'the client').replaceAll('[deadline]', deadline || 'the deadline');
}
