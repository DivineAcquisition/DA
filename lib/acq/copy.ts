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

/** Long-form coach and consultant landing. Same offer, reference-page structure. */
export const LANDING_REQUIREMENT = 'Three founding seats.';

export const LANDING_STATS = [
  { label: 'Free audit', detail: 'We walk the pipeline before anything is installed.' },
  { label: 'Done for you in 14 days', detail: 'Intake through reporting, live in the next 14 days.' },
  { label: 'Your stack stays', detail: 'Keep your CRM, calendar, and processor.' },
] as const;

export const LANDING_GET_TITLE = 'What you actually get';

export const LANDING_WHY = {
  eyebrow: 'Why the audit is free',
  intro: "Here's the thing.",
  body: 'The install only works when the leak is in follow-up, booking, and show rate. The audit is how we see that. It is free. Three founding seats are open at launch pricing. When they fill, pricing moves to standard.',
  points: [
    {
      title: 'Inquiries never get scored',
      body: 'Every inquiry should be captured, scored, and routed so only ready leads hit the calendar.',
    },
    {
      title: 'Follow-up stops too early',
      body: 'Leads that need time and leads that are ready now should not share one sequence.',
    },
    {
      title: 'Booked calls do not show',
      body: 'Without reminders, reschedules, and no-show recovery, the calendar fills and the calls do not happen.',
    },
    {
      title: 'You cannot see what produced the deal',
      body: 'If source, booked call, and closed deal are not connected, more traffic does not tell you what to scale.',
    },
  ],
  closeTitle: 'So the audit comes first.',
  closeBody:
    'You see where demand is leaking. If it is a fit, the system is live in 14 days, in the stack you already use.',
} as const;

export const LANDING_WHO = {
  eyebrow: 'Who this is for',
  items: [
    {
      title: 'Coaches',
      body: 'You already generate demand for a coaching program. The gap is turning that demand into booked calls that show.',
    },
    {
      title: 'Consultants',
      body: 'You sell a consulting engagement, and intake, follow-up, and booking still depend on someone remembering.',
    },
  ],
} as const;

export const LANDING_FAQ_TITLE = 'Questions you may have';

export const LANDING_FAQ = [
  {
    q: 'Is the audit actually free?',
    a: 'Yes. The audit is free. We walk your pipeline, show you where demand is leaking, and confirm whether the 14-day founding install is a fit.',
  },
  {
    q: 'How fast is it live?',
    a: 'Completely done for you in the next 14 days.',
  },
  {
    q: 'Do I have to switch tools?',
    a: 'No. Keep your CRM, calendar, and processor.',
  },
  {
    q: 'What is included?',
    a: 'Lead intake and scoring, dual follow-up sequences, activity tracking, show-rate protection, pipeline reactivation, revenue attribution, and an ops dashboard.',
  },
  {
    q: 'How many founding seats are open?',
    a: 'Three founding seats at launch pricing. When these seats fill, pricing moves to standard.',
  },
  {
    q: 'What happens after I book?',
    a: 'You get a confirmation, lock the time, and watch the briefing before the call so the audit is about your numbers.',
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

export const PRACTICES_COMPLIANCE =
  "This site is not part of, or endorsed by, Facebook or any social platform. Results shown are specific partners' outcomes and are not typical or guaranteed. © 2026 DivineACQ. All rights reserved.";

/** Direct-book landing for med spas and dental practices (`/practices`). */
export const PRACTICES = {
  pill: 'For Med Spas & Dental Practices',
  titleBefore:
    "We'll Run Your Meta Ads & Build The Follow\u2011Up System That Answers Every Lead In Under 60 Seconds, ",
  titleAccent: 'Completely Done For You, In The Next 14 Days,',
  titleAfter: ' To Increase Booked Consults',
  title:
    "We'll Run Your Meta Ads & Build The Follow\u2011Up System That Answers Every Lead In Under 60 Seconds, Completely Done For You, In The Next 14 Days, To Increase Booked Consults",
  body: 'A 30-minute audit showing you what your practice is already sitting on, and what it would take to work it. Pick a time below.',
  calendarTitle: 'Book your 30-minute practice audit',
  calendarNote: '15-30 mins & Free Audit.',
  cta: 'Pick a time',
  founder: {
    eyebrow: "Who's behind this",
    name: 'Malik',
    role: 'Founder of Divine Acquisition',
    photoAlt: 'Malik, founder of Divine Acquisition',
    intro: "I'm Malik, founder of Divine Acquisition.",
    paragraphs: [
      "I've run ads and built acquisition systems across a few industries, and the same thing was true in every one: the ads worked. Leads came in. Then they sat. These businesses weren't short on demand, they were short on a way to respond to it, and almost all of them were buying more leads to fix a problem more leads couldn't fix.",
      "That's what led me here. I stopped selling traffic and started building the layer underneath it, the one that answers every lead in under 60 seconds and follows up until someone books.",
      'Med spas have that problem worse than most. The decision is impulsive, it happens at night, and the person who should be answering is usually with a client.',
      "You'll be working with me directly, not an account manager. That's also why I only take on a few practices at a time.",
    ],
  },
  beliefs: {
    eyebrow: 'What I believe about growth',
    lead: "Growth is not a demand problem. It's an operations problem.",
    body: "Almost every business I've worked with believed it needed more leads. Almost none of them did. The gap between interest and revenue is operational, and no amount of traffic closes it. Buy more leads into a broken response layer and you get the same outcome at a higher cost.",
    items: [
      {
        title: 'Systems over hustle.',
        body: "Nobody outworks a structural problem. Answering faster is not a discipline issue you solve by trying harder, it's a system you either have or you don't. I build the system so the outcome stops depending on whether anyone remembered.",
      },
      {
        title: 'Truth over comfort.',
        body: "If the numbers say something isn't working, you'll hear it from me. I'd rather tell you the install isn't producing than invoice you for another month of activity.",
      },
      {
        title: 'Value that compounds.',
        body: "I'm not optimizing for a good first month. I'm building infrastructure that gets more valuable the longer it runs, because every lead it catches is one you already paid for and would otherwise have lost.",
      },
    ],
    closeTitle: 'Devotion. Value. Exclusivity.',
    closeBody:
      "I do the work myself. I measure in booked consults, not impressions. And I take one practice per territory, so your system is never also your competitor's.",
  },
  compliance: PRACTICES_COMPLIANCE,
  coversEyebrow: 'On the call',
  coversTitle: 'What we will look at',
  covers: [
    {
      title: 'Demand you already paid for',
      body: 'Inquiries, DMs, web forms, and abandoned consults sitting idle while ads keep running.',
    },
    {
      title: 'Where patients drop',
      body: 'No-shows, unconfirmed appointments, and follow-up that stops after the first text.',
    },
    {
      title: 'What it would take',
      body: 'The system to work that inventory, and whether it is worth installing in your practice.',
    },
  ],
} as const;
