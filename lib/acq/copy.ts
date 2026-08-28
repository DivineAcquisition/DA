/** Landing + qualification copy for the founding-install acq surface. */

export const PILL_BANNER = 'Sales Operations For Coaching & Consultants';

export const HEADLINE_BEFORE =
  "We'll Build & Run Your Sales Operation Systems To Help Turn The Demand You Are Generating Into Booked Calls — ";

export const HEADLINE_ACCENT = 'Completely Done For You In The Next 14 Days';

export const HEADLINE_AFTER = ' To Increase Show Rate';

export const HEADLINE = `${HEADLINE_BEFORE}${HEADLINE_ACCENT}${HEADLINE_AFTER}`;

export const SUBHEADLINE =
  "We're taking on 3 coaching businesses as founding installs at a reduced rate. Same system, same 14-day build, first-mover pricing.";

export const CTA_LABEL = 'See If You Qualify';
export const SUBMIT_LABEL = 'Submit Application';

export const INCLUDED_HEADLINE = "What's Included";
export const INCLUDED = [
  {
    title: 'Lead intake and readiness scoring',
    body: 'Every inquiry is captured, scored, and routed so your team only works leads that are ready.',
  },
  {
    title: 'Two follow-up tracks',
    body: 'Nurture for not-ready leads. Fast-close cadence for ready leads.',
  },
  {
    title: 'Full touch tracking',
    body: 'Every call, text, and message is logged against the deal so nothing falls through.',
  },
  {
    title: 'Call protection',
    body: 'Reminders, no-show recovery, and objection-branched follow-up so booked calls actually happen.',
  },
  {
    title: 'Dormant list reactivation',
    body: 'Old inquiries get a structured second chance instead of sitting in a spreadsheet.',
  },
  {
    title: 'Revenue attribution',
    body: 'You see which source produced the booked call and the closed deal.',
  },
  {
    title: 'Operator dashboard and monthly report',
    body: 'One view of pipeline health, plus a monthly readout you can actually use.',
  },
] as const;
export const INCLUDED_FOOTNOTE =
  'Built in 14 days. You keep your CRM, your calendar, and your payment processor.';

export const FOUNDING_OFFER = {
  eyebrow: 'Founding install',
  lead: "We're only taking 3 businesses at this rate.",
  body: 'You get the full system, built in 14 days, at founding pricing. Once these spots are filled, pricing goes to standard rate.',
} as const;

export const FAQ_HEADLINE = 'Questions';
export const FAQ = [
  {
    q: 'I already have a setter doing follow-up.',
    a: "Good. Then this makes them dramatically more effective, because right now you can't see what they're actually doing. Once touch tracking is on, you'll know how many calls they really made and which leads they never opened.",
  },
  {
    q: 'I already use GoHighLevel and I have automations.',
    a: "Almost everyone does. Automations send emails. What's missing is the layer that decides who deserves a human, when, and whether that human actually showed up. We build on top of your GHL, not instead of it.",
  },
  {
    q: 'My list is burned out.',
    a: "Then the dormant reactivation campaign is the first thing we run, and it's four messages, not forty.",
  },
  {
    q: 'Do I have to switch anything?',
    a: 'No. Not your CRM, not your processor, not your calendar.',
  },
  {
    q: 'How fast will I see something?',
    a: 'The build is 14 days, but the reactivation campaign runs in week one against leads you already have.',
  },
  {
    q: 'What if my leads are just low quality?',
    a: "Then you'll know within 30 days, with actual numbers instead of a feeling.",
  },
] as const;

export const BOOK_PAGE = {
  eyebrow: 'Free sales audit',
  title: 'Book your free sales audit',
  titleBefore: 'Book your ',
  titleAccent: 'free sales audit',
  body: "Pick a time. We'll walk your pipeline, show you where demand is leaking, and confirm whether the 14-day founding install is a fit. The audit is free.",
} as const;

export const THANK_YOU = {
  title: "Thanks — you're in. Grab a time below.",
  body: 'The calendar is open for every applicant. Your score only affects what happens after the call.',
} as const;

export const THANK_YOU_CALENDAR_PENDING =
  'The booking calendar will appear here as soon as the free sales audit embed is connected.';

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
