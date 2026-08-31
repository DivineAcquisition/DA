/** Landing + qualification copy for the founding-install acq surface. */

export const PILL_BANNER = 'Sales operations for coaching & consulting';

export const HEADLINE_BEFORE =
  "We'll Build & Run Your Sales Operation Systems To Help Turn The Demand You Are Generating Into Booked Calls. ";

export const HEADLINE_ACCENT = 'Completely Done For You In The Next 14 Days';

export const HEADLINE_AFTER = ' To Increase Show Rate';

export const HEADLINE = `${HEADLINE_BEFORE}${HEADLINE_ACCENT}${HEADLINE_AFTER}`;

export const SUBHEADLINE =
  'Intake, scoring, follow-up, booking, and reporting, installed in the stack you already use. Three founding seats at launch pricing.';

export const CTA_LABEL = 'Book a free audit';
export const SUBMIT_LABEL = 'Submit Application';

export const INCLUDED_HEADLINE = 'Product';
export const INCLUDED = [
  {
    title: 'Lead intake and scoring',
    body: 'Every inquiry is captured, scored, and routed so only ready leads hit the calendar.',
  },
  {
    title: 'Dual follow-up sequences',
    body: 'Nurture tracks for leads that need time. Fast-close cadence for leads that are ready now.',
  },
  {
    title: 'Activity tracking',
    body: 'Every call, text, and message is logged to the deal so nothing drops.',
  },
  {
    title: 'Show-rate protection',
    body: 'Reminders, reschedules, and no-show recovery so booked calls actually happen.',
  },
  {
    title: 'Pipeline reactivation',
    body: 'Dormant inquiries get a structured second pass instead of sitting idle.',
  },
  {
    title: 'Revenue attribution',
    body: 'See which source produced the booked call and the closed deal.',
  },
  {
    title: 'Ops dashboard',
    body: 'One view of pipeline health, plus a monthly report your team can run on.',
  },
] as const;
export const INCLUDED_FOOTNOTE = 'Live in 14 days. Keep your CRM, calendar, and processor.';

export const FOUNDING_OFFER = {
  eyebrow: 'Launch pricing',
  lead: 'Three founding seats.',
  body: 'Full system live in 14 days, at founding rate. When these seats fill, pricing moves to standard.',
} as const;

export const BOOK_PAGE = {
  eyebrow: 'Free sales audit',
  title: 'Book your free sales audit',
  titleBefore: 'Book your ',
  titleAccent: 'free sales audit',
  body: "Pick a time. We'll walk your pipeline, show you where demand is leaking, and confirm whether the 14-day founding install is a fit. The audit is free.",
} as const;

export const THANK_YOU = {
  title: "Thanks. You're in. Grab a time below.",
  body: 'The calendar is open for every applicant. Your score only affects what happens after the call.',
} as const;

export const THANK_YOU_CALENDAR_PENDING =
  'The booking calendar will appear here as soon as the free sales audit embed is connected.';

export const PRECALL = {
  eyebrow: 'Confirmed',
  title: 'Your Free Sales Audit Has Been Confirmed',
  titleBefore: 'Your Free Sales Audit Has Been ',
  titleAccent: 'Confirmed',
  body: "Time is one of the most valuable things either of us has. This audit takes real energy on my end, and all I ask in return is that you respect that with the same devotion I'm putting into your business.",
  stepsEyebrow: 'What To Expect',
  stepsTitle: 'Here Are Your Next Steps After Booking A Call',
  stepsBody:
    'Do these three things before we talk so the hour is used the way it should be.',
  steps: [
    {
      label: 'Check your email',
      body: 'Open the confirmation we just sent. Accept the calendar invite so the time is locked on your phone, not only in your inbox.',
    },
    {
      label: 'Protect the time',
      body: 'Treat this slot as locked. If something changes, reschedule early. A no-show wastes the work already in motion for your audit.',
    },
    {
      label: 'Self-educate',
      body: 'Watch the video on this page before we talk. Come ready to walk through ad spend, show rate, and how follow-up happens today.',
    },
  ],
} as const;

export const QUALIFY_DIALOG = {
  title: 'See if you qualify',
  description: 'A few questions so we can review fit.',
  submit: SUBMIT_LABEL,
} as const;

export const FORM_LABELS = {
  fullName: 'Full Name',
  email: 'Email',
  phone: 'Phone',
  companyName: 'Company Name',
  adSpend: 'Roughly how much do you spend on ads per month?',
  followUp: "Who handles follow-up on leads that don't book right away?",
  programPrice: "What's your program priced at?",
} as const;

export const FACEBOOK_DISCLAIMER =
  'This site is not a part of the Facebook website or Facebook Inc. Additionally, this site is NOT endorsed by Facebook in any way. FACEBOOK is a trademark of META PLATFORMS, Inc.';
