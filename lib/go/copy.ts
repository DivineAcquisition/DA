/** Landing copy for the residential cleaning funnel. Source: revenueweave-hub. */

export const PILL_BANNER = 'For remote-operated residential cleaning companies doing $15K+/month';

export const HEADLINE_BEFORE = 'More jobs. More referrals. ';
export const HEADLINE_ACCENT = 'More recurring revenue.';
export const HEADLINE_AFTER =
  ' Built for remote cleaning companies that run on systems, not phone calls.';

export const SUBHEADLINE =
  "We'll install AI-powered booking, follow-up, and retention so you stop chasing leads and start building a business that grows on autopilot.";

export const CTA_LABEL = 'Book a strategy session';
export const PRICING_LINE = 'Billed monthly. $397/month. 90-day engagement.';
export const DEMO_LABEL = 'AI booking layer live';
export const VIDEO_LABEL = 'Watch this 3-min breakdown (important)';

export const LANDING_TRUST = [
  'Live in 14 days',
  'Keep Jobber, Housecall Pro, or ServiceTitan',
  '$397/month for 90 days',
] as const;

export const CALENDAR = {
  eyebrow: 'Strategy session',
  titleBefore: 'Book your ',
  titleAccent: 'strategy session',
  titleAfter: ' here',
  body: 'Pick a weekday. You get a confirmation, then a reminder 24 hours before and 2 hours before by email and text, and a text 15 minutes before with the Google Meet link.',
} as const;

export const BOOKING = {
  fullName: 'Full name',
  email: 'Email',
  phone: 'Mobile number',
  phoneNote:
    'Used for the 24-hour text, the 2-hour text, and the 15-minute text with your Google Meet link. No marketing texts.',
  emailNote: "Confirmation and reminders go here.",
  showUpPrompt:
    'Can you commit to show up in a private area, with no noise and undivided attention, just as we will bring our focus and effort to this call?',
  showUpYes: 'Yes. I will be in a private, quiet place with my full attention.',
  showUpNo: 'No. I cannot commit to that.',
  showUpDecline:
    'This call needs a private, quiet place and your full attention. Book when you can give it that.',
  smsConsent:
    'I agree to receive calls and text messages from DivineAcquisition LLC and team members of DivineAcquisition, including automated appointment reminders about my strategy session and our services. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.',
  emailConsent:
    'I agree to receive emails from DivineAcquisition, including the confirmation and reminders about my strategy session. I can unsubscribe anytime.',
  submit: 'Book this time',
  submitting: 'Booking…',
  confirmedTitle: 'Your strategy session is booked.',
  confirmedNote: 'Check your email for the confirmation. The Google Meet link is in that email and in the 15-minute text.',
} as const;

/** The second booking question is not written yet. Only the show-up commitment is on the form. */

export const LEGAL_TERMS_URL = 'https://acq.divineacquisition.io/terms';
export const LEGAL_PRIVACY_URL = 'https://acq.divineacquisition.io/privacy';

export const INCLUDED_HEADLINE = "What's included";
export const INCLUDED_TITLE = 'The stack we install in your cleaning company.';
export const INCLUDED = [
  {
    title: 'Missed-call & after-hours booking',
    body: "While your team's on a clean, AI answers, qualifies, and books. The lead doesn't bounce to the next Google listing.",
  },
  {
    title: 'Speed-to-lead on Facebook & Google forms',
    body: 'Web leads get a text in seconds — not when you finish the last house at 6pm.',
  },
  {
    title: '21-day quote follow-up',
    body: "Move-out, deep-clean, and recurring estimates get a close cadence until they book or opt out. No more 'I'll circle back.'",
  },
  {
    title: 'Show-rate & no-show recovery',
    body: 'Reminders before the appointment, one-tap reschedule, and a recovery sequence if they ghost the first clean.',
  },
  {
    title: 'Recurring conversion on the booking page',
    body: "First-time cleans convert to bi-weekly or monthly before they leave the scheduler — not after you remember to ask.",
  },
  {
    title: 'Post-clean reviews & win-backs',
    body: 'Check-in and Google review request while the house still smells like you were there. Lapsed recurring clients get a reactivation sequence.',
  },
] as const;
export const INCLUDED_FOOTNOTE =
  "Live in 14 days. Keep Jobber, Housecall Pro, or ServiceTitan. Keep the ads you're already running.";

export const PROBLEMS_EYEBROW = 'Where the jobs leak';
export const PROBLEMS_HEADLINE = "Your ads are working. The phone and the follow-up aren't.";
export const PROBLEMS = [
  {
    title: "Missed calls while you're on a job",
    description:
      'A homeowner calls during a clean. Voicemail. They hang up and tap the next listing. That missed call was a $150–$300 first-time clean — and maybe a bi-weekly route.',
  },
  {
    title: 'Form fills that go cold overnight',
    description:
      "They submit from Facebook at 9pm. You call at 10am from the van. They already booked someone who texted back in two minutes. Speed-to-lead isn't a slogan in this market — it's who gets the house.",
  },
  {
    title: 'Estimates that never get a second touch',
    description:
      "You send 10 move-out or deep-clean quotes. Three reply. The other seven sit in Jobber. No cadence means you're donating five figures a year to whoever followed up.",
  },
  {
    title: 'First-time cleans that never become a route',
    description:
      "They loved the work. Six months later they can't remember the company name. Without a booking-page membership offer and a post-clean ask, most of them never come back.",
  },
] as const;

export const SYSTEMS_EYEBROW = 'What we install';
export const SYSTEMS_HEADLINE = 'Missed calls, dead quotes, and one-time cleans — handled.';
export const SYSTEMS_LEAD = 'Three layers on the stack you already run. Not a new CRM. Not a social media retainer.';
export const SYSTEMS = [
  {
    key: 'book',
    title: 'Book the missed call',
    description:
      'AI picks up 24/7, texts missed callers in 60 seconds, and puts a qualified clean on the calendar before a competitor answers.',
  },
  {
    key: 'close',
    title: 'Close the estimate',
    description:
      'Seven-touch quote follow-up, show-rate reminders, and no-show recovery so move-outs and deep cleans become paying jobs.',
  },
  {
    key: 'keep',
    title: 'Keep the client',
    description:
      'Convert the first clean to bi-weekly on the scheduler. Post-job check-in, Google review, and win-back if they lapse.',
  },
] as const;

export const PROCESS_EYEBROW = 'How it works';
export const PROCESS_HEADLINE = "Fourteen days. Then you're not the after-hours receptionist.";
export const PROCESS = [
  {
    title: 'Strategy session',
    description:
      "We look at your missed-call log, Jobber or Housecall Pro calendar, and where Facebook/Google leads stall. If it's not a fit, we say so.",
  },
  {
    title: 'We install it',
    description:
      'Booking, follow-up, and retention go live in 14 days on GoHighLevel, wired into the ops software you already use. You keep running jobs.',
  },
  {
    title: 'The calendar fills',
    description:
      'More first-time cleans show. More of them convert to recurring. After-hours demand stops depending on who had the company phone.',
  },
] as const;

export const MATH_EYEBROW = 'The math';
export const MATH_HEADLINE = 'Same ad spend. More cleans on the board.';
export const MATH_LEAD =
  'Model for a residential team already buying Facebook or Google leads — before vs after the backend is installed.';
export const MATH = [
  {
    title: 'Ad leads that book a clean',
    from: '30',
    to: '70',
    caption: 'Out of 100 monthly inbound leads.',
  },
  {
    title: 'Jobs that actually get done',
    from: '20',
    to: '55',
    caption: 'Show-rate and no-show recovery, not just bookings on a calendar.',
  },
  {
    title: '12-month revenue from that spend',
    from: '$14k',
    to: '$96k',
    caption:
      'Includes recurring conversion — not just one-off first cleans. The $397/month engagement is a rounding error against that.',
  },
] as const;

export const FIT_EYEBROW = 'Fit';
export const FIT_HEADLINE = 'This is for residential cleaning operators who already have demand.';
export const FIT_YES_TITLE = 'This is for you if';
export const FIT_NO_TITLE = 'This is not for you if';
export const FIT_YES = [
  "You run a residential or remote cleaning company (maid service, recurring house cleans, move-outs)",
  "You're doing $15K–$250K/month",
  "You have a team — or VAs / an office manager — and you're not trying to be the only person on the phone",
  "You're already generating leads (ads, Google, referrals) and losing jobs after they come in",
] as const;
export const FIT_NO = [
  "You're a solo operator with no plan to hire",
  "You're under $15K/month and still figuring out demand",
  "You want a social-media manager, not a booking and follow-up install",
  "Commercial janitorial, construction cleaning, or you won't run the sequences we put in place",
] as const;

export const TESTIMONIALS_EYEBROW = 'Real results';
export const TESTIMONIALS_HEADLINE = 'Built on live cleaning revenue. Not theory.';
export const TESTIMONIALS_LEAD =
  'Residential cleaning owners running this stack right now. Names, companies, and numbers from their books — not a composite case study.';
export const TESTIMONIALS = [
  {
    initials: 'NA',
    name: 'Nathan',
    role: 'Founder, BadgerLuxClean',
    quote:
      "We processed 1,740 bookings and tracked $510K in revenue. 32% of our one-time customers converted to recurring service at the booking page — not after weeks of follow-up. That's the number that matters.",
    stats: [
      { value: '1,740', label: 'Bookings processed' },
      { value: '$510K', label: 'Tracked revenue' },
      { value: '32.3%', label: 'Recurring conversion' },
    ],
    videoId: null,
    videoAspect: '16/9',
  },
  {
    initials: 'MA',
    name: 'Maurisa Alexis Louis',
    role: 'Founder, Bay Area Cleaning Pros',
    quote:
      "We added $50K in new annual revenue from bookings that would've been phone tag. Customers see the price, pick their time, and the job's on the calendar before I'd even have called them back.",
    stats: [
      { value: '$50K', label: 'New annual revenue' },
      { value: '24/7', label: 'Booking capture' },
      { value: 'Q2 2025', label: 'Live since' },
    ],
    videoId: '2a8dvtqmfd',
    videoAspect: '16/9',
  },
  {
    initials: 'WC',
    name: 'Will Cole',
    role: 'Owner, Mean Cleaning & Restoration',
    quote:
      "Just want to take the time out to thank Malik for his patience, for just being very resourceful and having a passion for my business as much as I do. And also, with Malik, he's very, very informative and very prompt, and there's nothing that Malik doesn't know when it comes to growing your business.",
    stats: [
      { value: '$16K', label: 'MRR added in 91 days' },
      { value: '21', label: 'New bookings' },
      { value: '41%', label: 'Conversion rate' },
    ],
    videoId: '6p65esjllh',
    videoAspect: '9/16',
  },
] as const;

export const FOUNDING_OFFER = {
  eyebrow: 'The engagement',
  lead: '$397/month. 90 days.',
  body: 'Missed-call booking, quote follow-up, and retention — installed on your current ops stack, not a course and not a social retainer. When this tier closes, it returns to standard pricing.',
} as const;

export const FINAL_CTA = {
  headline: "Your next 20 missed calls don't have to be 20 missed cleans.",
  body: "Book the session. We'll pull up your pipeline and show you the leak — then whether a 14-day install is the right move.",
  caption: 'We take a handful of new residential cleaning installs at a time.',
} as const;

export const FACEBOOK_DISCLAIMER =
  'This site is not a part of the Facebook website or Facebook Inc. Additionally, this site is NOT endorsed by Facebook in any way. FACEBOOK is a trademark of META PLATFORMS, Inc. We use cookies, including third-party cookies, on this website to help operate our site and for analytics and advertising purposes.';

export const FAQ = {
  headline: 'Questions owners usually ask before they book',
  items: [
    {
      question: 'How long until this is live on my Jobber / Housecall Pro?',
      answer:
        "14 days from kickoff. You keep running cleans while we build it. Most owners see missed-call bookings move in the first week once it's live.",
    },
    {
      question: 'Do you run our Facebook or Google ads?',
      answer:
        'No. This engagement is what happens after the lead comes in. We can review creative and positioning on the strategy session. Ad management is a separate service if you already want it.',
    },
    {
      question: "We're about to turn ads on. Should we wait?",
      answer:
        'Build the backend first. If voicemail and next-day follow-up are what you have, turning on spend just buys more missed cleans. Have booking and follow-up ready before you scale the budget.',
    },
    {
      question: "What's the investment?",
      answer:
        '$397/month for 90 days. We confirm fit and exact scope on the strategy session — including whether your volume and stack are a match.',
    },
    {
      question: "How do we know it's working?",
      answer:
        "We track speed-to-lead, booked cleans, show rate, and recurring conversion weekly. If a sequence isn't converting, we change it. You see the same numbers we do.",
    },
    {
      question: 'Do we have to leave Jobber or Housecall Pro?',
      answer:
        'No. We build on GoHighLevel and connect Jobber, Housecall Pro, ServiceTitan, and the calendar/SMS stack you already use. The point is to stop swapping tools every quarter.',
    },
  ],
} as const;
