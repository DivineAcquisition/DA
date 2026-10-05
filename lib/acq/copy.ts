/** Landing + qualification copy for the coach and consultant acq surface. */

export const PILL_BANNER = 'For coaches and consultants whose inquiries already come in';

export const HEADLINE_BEFORE =
  "We'll Build & Run Your Sales Operation Systems To Help Turn The Demand You Are Generating Into Booked Calls. ";

export const HEADLINE_ACCENT = 'Completely Done For You In The Next 14 Days';

export const HEADLINE_AFTER = ' To Increase Show Rate';

export const HEADLINE = `${HEADLINE_BEFORE}${HEADLINE_ACCENT}${HEADLINE_AFTER}`;

export const SUBHEADLINE =
  'Not more ads, and not a new offer. A first reply, a booking path, reminders before the call, and a follow-up for people who need to think about it. The 30-minute audit is free, and you keep what we find.';

export const LANDING_QUALIFIER =
  'You already get inquiries. If you do not, this is not the install.';

export const LANDING_TRUST = ['30-minute audit, free', 'You keep the findings', 'You own what we install'] as const;

export const CTA_LABEL = 'Book the free 30-minute audit';
export const SUBMIT_LABEL = 'Book the free 30-minute audit';

export const PROBLEM = {
  eyebrow: 'The problem',
  body: 'A new inquiry waits for hours, sometimes until the next morning. The person who was ready books with whoever answered. The person who says they need to think about it never hears from you again. Most coaches and consultants don\'t have a lead problem. They have a follow-up problem: the reply is slow, the booked call does not show, and "not yet" goes quiet.',
} as const;

export const QUESTIONS = {
  eyebrow: "Three questions we'll answer for you",
  items: [
    'How many minutes until a new inquiry gets a reply?',
    'How many booked calls this month actually showed up?',
    'What is the next message when someone says they need to think about it?',
  ],
} as const;

export const BUILD = {
  eyebrow: 'So what do you actually get?',
  items: [
    {
      title: 'Reply in under 60 seconds',
      body: 'A first response and a booking link go out when the inquiry arrives, including after hours, so the lead is not waiting until morning.',
    },
    {
      title: 'Show-up sequence',
      body: 'A confirmation, a reminder the day before, and a reminder the morning of, plus a reschedule path when they cannot make it.',
    },
    {
      title: 'Follow-up for "not yet"',
      body: 'People who are not ready get a short sequence in your voice, instead of one unanswered "let me think about it."',
    },
    {
      title: 'Weekly numbers',
      body: 'Inquiries, booked calls, shows, and closes in one view, including the weeks that got worse.',
    },
  ],
} as const;

export const HOW_IT_WORKS = {
  eyebrow: 'How it works',
  steps: [
    {
      label: 'Free audit, 30 minutes',
      body: 'We time the reply, count the shows, and look at what happens after "not yet." You keep that map if you never hire us.',
    },
    {
      label: 'Install in 14 days',
      body: 'We put the reply, the show-up reminders, and the "not yet" follow-up in place, and write the lines in your voice for you to approve.',
    },
    {
      label: 'Weekly review',
      body: 'We read inquiries, bookings, shows, and closes with you, including the week that got worse, and change the line that is not moving them.',
    },
  ],
} as const;

export const WHY_US = {
  eyebrow: 'Why the audit is free',
  lead: 'We are early, so the audit is the proof. You see the leaks before you pay for an install.',
  items: [
    'The audit is free, and you keep the findings if you walk away.',
    'You own the scripts and the system we install.',
    'Every week you see inquiries, bookings, shows, and closes, including the weak ones.',
    'We start with a limited pilot, not a long contract.',
  ],
} as const;

export const AUDIENCE = {
  eyebrow: "Who it's for",
  fit: 'Coaches and consultants who already sell a real program or retainer, already receive inbound inquiries, and want the time between "I\'m interested" and a call that shows to stop depending on memory.',
  notFit:
    'Not for get-rich-quick offers, and not for anyone without a real offer or the willingness to close.',
} as const;

export const FAQ = {
  eyebrow: 'Questions you may have',
  items: [
    {
      question: 'Will this sound like a script?',
      answer: 'No. You approve every line, and we write it in your voice.',
    },
    {
      question: 'Do you generate my leads?',
      answer: 'No. We fix what happens after they arrive.',
    },
    {
      question: 'What does it cost?',
      answer:
        'The 30-minute audit is free. Install pricing is quoted after we see your reply time, show rate, and the "not yet" pile. It is a pilot, not a long contract.',
    },
  ],
} as const;

export const CLOSING = {
  title: 'Find out where your leads are leaking.',
  cta: CTA_LABEL,
  note: '30 minutes. Free. You keep the findings either way.',
} as const;

export const BOOK_PAGE = {
  eyebrow: 'Free audit',
  title: 'Book your free audit',
  titleBefore: 'Book your ',
  titleAccent: 'free audit',
  body: "Pick a time. We'll review your current process and show you where leads drop. The audit is free.",
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
  eyebrow: 'Free audit',
  title: 'Book the free 30-minute audit',
  description: 'A few details so the 30 minutes is about your pipeline, not a generic pitch.',
  submit: SUBMIT_LABEL,
} as const;

export const FORM_LABELS = {
  fullName: 'Name',
  email: 'Email',
  phone: 'Phone',
  companyName: 'Company Name',
  offer: 'What you sell',
  adSpend: 'Roughly how much do you spend on ads per month?',
  inquiries: 'Inquiries per month',
  followUp: 'Who handles follow-up',
  programPrice: 'Price of your main offer',
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
