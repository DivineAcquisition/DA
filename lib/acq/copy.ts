/** Landing + qualification copy for the coach and consultant acq surface. */

export const PILL_BANNER = 'For coaches with a paid membership';

export const HEADLINE_BEFORE =
  "We'll Install The Retention System That Cuts Month-2 Churn 25-35% ";

export const HEADLINE_ACCENT = 'In The First Membership Cycle,';

export const HEADLINE_AFTER = ' Without You Chasing A Single Member';

export const HEADLINE = `${HEADLINE_BEFORE}${HEADLINE_ACCENT}${HEADLINE_AFTER}`;

export const SUBHEADLINE =
  'Onboarding, a daily engagement score, at-risk alerts, and the ask that moves monthly members to annual. The same build, live in 30 days. $4,500. After handoff, management is $497 a month if you want it.';

export const LANDING_QUALIFIER =
  'Health, fitness, and wellness coaches on Skool, at $300K to $1M a year, with 50 to 300 paying members.';

export const LANDING_TRUST = ['Live in 30 days', '$4,500 build', 'You own the system'] as const;

export const CTA_LABEL = 'Apply for the 30-day build';
export const SUBMIT_LABEL = 'Apply for the 30-day build';

export const PROBLEM = {
  eyebrow: 'The problem',
  body: "Members join, then go quiet, and you are the one noticing. Most of these coaches don't have a lead problem. The members already paid. The leak is after they enroll: onboarding depends on you, nobody is flagged before they ghost, and monthly members are never asked to go annual.",
} as const;

export const QUESTIONS = {
  eyebrow: "Three questions we'll answer for you",
  items: [
    'What share of new members are still paying in month 2?',
    'Who is told when a member goes quiet, and how fast?',
    'What asks a monthly member to switch to annual?',
  ],
} as const;

export const BUILD = {
  eyebrow: 'What gets installed in 30 days',
  items: [
    {
      title: '14-day onboarding',
      body: '5 emails, 3 in-platform messages, and 2 milestone triggers, started from the day they enroll.',
    },
    {
      title: 'Engagement score',
      body: 'A daily green, yellow, or red score from activity, content, and participation in the community.',
    },
    {
      title: 'At-risk alerts',
      body: 'A Slack or email alert when a member turns yellow or red, with the message to send.',
    },
    {
      title: 'Monthly to annual',
      body: 'At day 60 and day 90: a proof email, the annual offer, and a founder DM template.',
    },
    {
      title: 'Retention dashboard',
      body: 'Active members, churn by cohort, at-risk count, annual conversion, and MRR. It updates daily.',
    },
    {
      title: 'Cancellation save',
      body: 'A cancel routes through a pause offer, then a downgrade, then a founder DM.',
    },
    {
      title: 'SOP and training',
      body: 'A written SOP and a 30-minute training so you can run the alerts and the dashboard after handoff.',
    },
  ],
} as const;

export const HOW_IT_WORKS = {
  eyebrow: 'The 30 days',
  steps: [
    {
      label: 'Week 1, foundation',
      body: 'Kickoff, platform and Stripe access, a member export, and a written baseline. The audit review is on day 7.',
    },
    {
      label: 'Week 2, onboarding and scoring',
      body: 'The 14-day onboarding sequence and the daily engagement score go live.',
    },
    {
      label: 'Week 3, alerts and the annual offer',
      body: 'At-risk alerts, the day-60 and day-90 annual sequence, the dashboard, and the cancellation save flow go live.',
    },
    {
      label: 'Week 4, handoff',
      body: 'The SOP, a 30-minute training, 7 days of monitoring, and the final handoff on day 30.',
    },
  ],
} as const;

export const WHY_US = {
  eyebrow: 'The price',
  lead: 'The build is $4,500. $2,250 when you sign. $2,250 on day 30, before the handoff call.',
  items: [
    'You own the sequences, the score, the alerts, and the dashboard.',
    'Two revision rounds are included on each deliverable.',
    'After day 30, management is $497 a month if you want it. Some clients run it themselves.',
    'That retainer is a 90-day minimum, then month to month with 30 days notice.',
  ],
} as const;

export const AUDIENCE = {
  eyebrow: "Who it's for",
  fit: 'Health, fitness, and wellness coaches on Skool with a paid membership, or a program plus monthly continuity. $300K to $1M a year. 50 to 300 active paying members. You can give the alerts 30 minutes a week.',
  notFit:
    'Not for get-rich-quick offers. Not under $200K a year, not under 30 paying members, not off Skool, and not if you cannot spend 30 minutes a week on the alerts.',
} as const;

export const FAQ = {
  eyebrow: 'Questions you may have',
  items: [
    {
      question: 'Is this a custom brand project?',
      answer:
        'No. It is the same 7-part build every time. The only changes are your platform and your content.',
    },
    {
      question: 'Do you generate my leads?',
      answer: 'No. We build what happens after a member enrolls.',
    },
    {
      question: 'What does it cost?',
      answer:
        'The build is $4,500: $2,250 when you sign, $2,250 on day 30 before handoff. Management after that is $497 a month, optional, with a 90-day minimum.',
    },
  ],
} as const;

export const CLOSING = {
  title: 'See if your membership is a fit.',
  cta: CTA_LABEL,
  note: 'If you are under $200K, under 30 members, or not on Skool, this is not the build.',
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
  eyebrow: 'Application',
  title: 'Apply for the 30-day build',
  description: 'Your program, what it costs, and how many inquiries come in. We use that to see if the retention build is a fit.',
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
