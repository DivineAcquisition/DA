import { ACQ_ICLOSED_EVENT_URL, ACQ_ICLOSED_TITLE } from './config';

/**
 * All public copy for the Revenue Leak Audit landing page.
 * Edit text here. The layout reads this object and does not hard-code sentences.
 *
 * Leave testimonials empty until the GoHighLevel page quotes are pasted in.
 * Leave guarantee as an empty string until the wording is ready.
 * The iClosed calendar is set. Override it with NEXT_PUBLIC_REVENUE_LEAK_ICLOSED_URL.
 * Leave video.url empty until the VSL link exists, or set NEXT_PUBLIC_REVENUE_LEAK_VSL_URL.
 */

/** Flip to false when the landing page should be indexed. */
export const REVENUE_LEAK_NOINDEX = true;

export type RevenueLeakTestimonial = {
  quote: string;
  name: string;
  business: string;
  /** Result figure from the GHL page, when one was published with the quote. */
  result?: string;
  /** Photo URL or site path from the GHL page. */
  photo?: string;
};

/**
 * Paste testimonials from the GoHighLevel landing page for this offer.
 * Names, businesses, quotes, photos, and result numbers must be copied, not written here from memory.
 * An empty list hides the Results section.
 */
export const REVENUE_LEAK_TESTIMONIALS: RevenueLeakTestimonial[] = [];

export type RevenueLeakStep = {
  id: string;
  name: string;
  gap: string;
  fix: string;
};

export const REVENUE_LEAK = {
  noindex: REVENUE_LEAK_NOINDEX,
  brand: 'Divine Acquisition',
  cta: 'Book your free audit',
  legalEmail: 'legal@divineacquisition.io',
  seo: {
    title: 'Free AI Revenue Leak Audit',
    description:
      'Free audit for local service owners. We install AI at every gap between the first contact and the paid invoice. Live in about 3 weeks.',
    canonical: 'https://acq.divineacquisition.io/leak',
    /**
     * Social share image. Swap this path for a 1200 by 630 image when you have one.
     * The mark below is the existing site icon, so the tag is valid while you test.
     */
    shareImage: '/icon-512.png',
    shareImageAlt: 'Divine Acquisition',
  },
  hero: {
    label: 'Free AI revenue leak audit',
    headline: "You don't have a lead problem. You have a gap problem.",
    subhead:
      'We install an AI system that closes every gap between the first contact and the paid invoice. Live in about 3 weeks.',
    videoCaption: 'Watch the 4 minute breakdown',
    videoPending: 'The video link is not set yet.',
    note: 'Free. 30 minutes. We mystery-shop your business first.',
    stats: [
      { value: '52%', label: 'of home service calls reach a person' },
      { value: '82%', label: 'of callers phone a competitor if nobody answers' },
      { value: '24% vs 59%', label: 'calls booked by shops under 5 techs vs 25 or more' },
    ],
    sourceLine:
      'Sources: Invoca 2026, Invoca 2024, CallRail September 2025, ServiceTitan, Hatch 2024, and SearchLight Digital February 2026.',
  },
  video: {
    url: process.env.NEXT_PUBLIC_REVENUE_LEAK_VSL_URL?.trim() || '',
    poster: '',
  },
  problem: {
    label: 'Where the money leaks',
    headline: 'More leads into the same gaps just costs more.',
    body: 'When revenue stalls, most owners buy more leads. But the leads they already pay for slip through calls nobody answers, replies that take hours, quotes nobody follows up and appointments that never show.',
    points: [
      { title: 'Missed calls.', body: 'Fewer than 3 in 100 callers leave a voicemail.' },
      { title: 'Slow replies.', body: '88% of HVAC companies take more than 5 minutes to answer a web lead.' },
      { title: 'Quotes that go cold.', body: 'Quoted once, never chased.' },
      { title: 'No-shows.', body: 'Booked, then gone, and the slot is wasted.' },
      { title: 'Admin at night.', body: 'Quotes, invoices and reschedules after the last customer leaves.' },
      {
        title: 'Paying for leads you never work.',
        body: 'At $51 to $57 a lead, every unanswered lead is money in the trash.',
      },
    ],
    callout: 'Every one of these is a gap. And a tool that fixes one gap leaves six open.',
  },
  pipeline: {
    label: 'The system, not a gadget',
    headline: 'A job passes through 7 handoffs. We put AI at every one.',
    hint: 'Tap a handoff to see the gap and the fix.',
    sealAll: 'Seal all 7 gaps',
    behind:
      'Behind the scenes the same system drafts estimates from a voice memo, screens job applicants and answers your team\'s questions from your own price list and procedures.',
    steps: [
      {
        id: 'call',
        name: 'Call',
        gap: 'About half of calls never reach a person.',
        fix: "AI answers every call, 24/7, in your company's name, books the job, sends emergencies to you live, and texts back any call it misses.",
      },
      {
        id: 'response',
        name: 'Response',
        gap: 'Web, Google and Facebook leads wait hours.',
        fix: 'Every new lead gets a reply in under 60 seconds.',
      },
      {
        id: 'booking',
        name: 'Booking',
        gap: 'Leads are not qualified and calendars are not filled.',
        fix: 'AI qualifies the job, tags what it is worth, and books it on your calendar while they are still engaged.',
      },
      {
        id: 'show',
        name: 'Show',
        gap: 'No-shows waste the slot.',
        fix: 'Reminders and confirmations go out automatically and no-shows are rebooked.',
      },
      {
        id: 'estimate',
        name: 'Estimate',
        gap: 'This is where most of the money dies. Quotes get sent once and never chased.',
        fix: 'Every unsold estimate gets followed up on day 1, 3, 7, 14 and 30.',
      },
      {
        id: 'payment',
        name: 'Payment',
        gap: 'Invoices go unpaid while you chase them.',
        fix: 'Invoices and past-due reminders chase themselves.',
      },
      {
        id: 'review',
        name: 'Review and return',
        gap: 'Few reviews, and past customers never come back.',
        fix: 'Every finished job asks for a review, and past customers are brought back in slow months with zero ad spend.',
      },
    ] satisfies RevenueLeakStep[],
  },
  compare: {
    label: 'Not the way most people think about AI',
    headline: 'A tool fixes one step. A system runs all of them.',
    gadget: {
      label: 'AI as a gadget',
      items: [
        'Chatbot on the website',
        'Robot voice on the phone',
        'AI writing social posts',
        "Your software's built-in AI receptionist",
        '1 gap closed, 6 still open',
        'You still hold it all together.',
      ],
    },
    system: {
      label: 'AI as a system',
      items: [
        'Connected across all 7 handoffs',
        'Built on the tools you already use',
        'Every message and call script approved by your team',
        'Managed every month so it keeps getting sharper',
        'You own every account',
      ],
    },
  },
  engines: {
    label: 'What we install',
    headline: 'One core system. Four engines.',
    items: [
      {
        title: 'Lead Engine',
        line: 'Every call and lead captured.',
        points: [
          'AI receptionist',
          'Missed-call text-back',
          'Instant replies',
          'Past-customer reactivation',
          'Review requests',
        ],
      },
      {
        title: 'Conversion Engine',
        line: 'More leads become booked and paid.',
        points: [
          'Lead scoring',
          '30-day estimate follow-up',
          'Reminders and confirmations',
          'Call scoring for your team',
          'Membership offers',
        ],
      },
      {
        title: 'Admin Autopilot',
        line: 'Get 10+ hours back each week.',
        points: [
          'Estimates from voice memos',
          'Invoice and past-due chasing',
          'Intake forms',
          'Applicant screening',
          'A staff assistant trained on your price list and procedures',
        ],
      },
      {
        title: 'Owner Command Center',
        line: 'Know your numbers before your first coffee.',
        points: [
          'One text every morning with calls, bookings, missed opportunities and revenue',
          'A live dashboard',
          'A monthly recovered-revenue report',
        ],
      },
    ],
  },
  packages: {
    label: 'How we work with you',
    headline: 'Two packages, one core system.',
    pricingNote: 'Pricing is shared on your audit call, built around your numbers.',
    /**
     * Guarantee line. Paste the wording here when you have it.
     * An empty string hides the line on the page.
     */
    guarantee: '',
    items: [
      {
        name: 'Revenue Engine',
        line: 'Close your lead and conversion gaps.',
        includes: ['The Lead Engine', 'The Conversion Engine', 'A basic Command Center'],
        fit: 'Best for owner-operators who still answer their own phones.',
      },
      {
        name: 'Full AI Operations',
        line: 'Close all seven gaps and the admin behind them.',
        includes: ['All four engines', 'The full Command Center', 'A new automation added every quarter'],
        fit: 'Best for businesses with office staff, multiple crews or multiple locations.',
      },
    ],
  },
  audit: {
    label: 'The free audit',
    headline: 'We call your business before we call you.',
    steps: [
      {
        label: 'We mystery-shop you.',
        body: 'We call after hours, call during the day, submit your web form and time every response.',
      },
      {
        label: 'We show you the leaks.',
        body: 'On a 30 minute call we walk through every gap we found and what it is likely costing you each month, in dollars.',
      },
      {
        label: 'You hear it for yourself.',
        body: 'You talk to an AI agent already set up with your business name.',
      },
    ],
    close: 'If we do not find money you are losing, you have lost nothing but 30 minutes.',
  },
  build: {
    label: 'How the build goes',
    headline: 'How the build goes.',
    steps: [
      { when: 'Days 1 to 3', label: 'Audit and data pull' },
      { when: 'Days 4 to 10', label: 'Build' },
      { when: 'Days 11 to 14', label: 'Test with mystery calls' },
      { when: 'Days 15 to 21', label: 'Go live and launch reactivation' },
    ],
    badges: ['Live in about 3 weeks', 'You own every account', 'Nothing goes out unapproved by your team'],
  },
  results: {
    label: 'Results',
  },
  faq: {
    label: 'Questions',
    items: [
      {
        question: "Won't customers hate talking to a robot?",
        answer:
          'The AI uses scripts and rules your team approves, speaks in your company\'s name, and hands the conversation to a person when it should. You hear it yourself on the audit call.',
      },
      {
        question: 'My software already has an AI receptionist. Why do I need this?',
        answer:
          'Answering the phone closes one gap. The numbers move when answering, booking, follow-up, reminders, invoices and reviews are connected into one system with tracking.',
      },
      {
        question: 'I have been burned by agencies and software before.',
        answer:
          'You own every account, there are no hostage tools, and we show you recovered revenue every month so you can see what is working.',
      },
      {
        question: 'Can AI really handle my kind of job and pricing?',
        answer:
          'It books and qualifies using your price list, service area and rules. Anything it should not decide goes to a person.',
      },
      {
        question: 'I do not have time to set this up.',
        answer:
          'We build it for you. You give us about an hour in the first week and we handle the rest, live in about 3 weeks.',
      },
      {
        question: 'What if my team will not use it?',
        answer:
          'Most of it runs on its own in the background, and your team approves the messages and scripts up front.',
      },
      {
        question: 'Does my customer data stay mine?',
        answer: 'Yes. Phone numbers, CRM data, ad accounts and domain all stay in your name.',
      },
    ],
  },
  booking: {
    label: 'Book your free audit',
    headline: 'Find out where your business is leaking.',
    /** Same iClosed event as the coaching and cleaning pages. */
    url: ACQ_ICLOSED_EVENT_URL,
    widgetTitle: ACQ_ICLOSED_TITLE,
    /** Schedule matches a booked call. Switch to Lead if that is the ad event. */
    event: 'Schedule' as 'Schedule' | 'Lead',
    pending: 'The booking calendar shows here once the iClosed link is added.',
    reassurance: 'Free. No obligation. Takes 30 minutes.',
    consent:
      'By booking, you agree to receive calls and texts about your audit. Message and data rates may apply. Reply STOP to opt out.',
    questions: [
      { label: 'Business name' },
      { label: 'Business phone number' },
      { label: 'Website' },
      {
        label: 'Monthly revenue range',
        options: ['Under $30K', '$30K to $100K', '$100K to $250K', '$250K and up'],
      },
      {
        label: 'Business type',
        options: [
          'HVAC',
          'Plumbing',
          'Electrical',
          'Roofing',
          'Garage doors',
          'Remodeling',
          'Med spa',
          'Dental',
          'Cleaning',
          'Other',
        ],
      },
      {
        label: 'Who answers your calls today',
        options: ['Me', 'Office staff', 'Answering service', 'Nobody consistently'],
      },
    ],
  },
  notYet: {
    title: 'We are best suited a step above where you are.',
    body: 'The Revenue Leak Audit is built for local service businesses above $30,000 a month right now. Under that, the install costs more than it gives back. You have not done anything wrong. When the month is there, book the audit and we will walk the gaps with you.',
    resourceLabel: 'Read the short resource',
    /** Paste a guide URL when you have one. Empty hides the button. */
    resourceUrl: '',
    listLabel: 'Join the list',
    /** Paste a list or email link. Empty hides the button. */
    listUrl: '',
  },
  sources: [
    'Invoca 2026 Home Services Benchmark (52% of calls reach a person).',
    'Invoca 2024 (voicemail: fewer than 3 in 100 callers leave one).',
    'CallRail consumer survey, September 2025 (82% of callers phone a competitor if nobody answers).',
    'ServiceTitan data on booking rates by company size (24% vs 59%).',
    'Hatch 2024 (88% of HVAC companies respond to web leads in more than 5 minutes).',
    'SearchLight Digital, February 2026 (Google Local Services Ads cost per lead $51 to $57).',
  ],
} as const;
