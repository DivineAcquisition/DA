/**
 * Niche landing copy. Layout reads this file and does not own the words.
 * Remodeling is a draft in this file. Do not add a route until it is published.
 */
import type { HeadlineVariant } from './niche-tracking';

export type SourceRef = {
  id: string;
  /** Number shown on the card superscript and in the sources list. */
  n: number;
  listing: string;
  href: string;
};

export type StatCard = {
  value: string;
  label: string;
  source: string;
  sourceId: string;
};

export type CopySpan = {
  text: string;
  /** Source ids, in order, rendered as one superscript after this span. */
  sourceIds?: string[];
};

export type SpendOption = {
  label: string;
  /** Lowest dollar amount this band represents. Qualified when this is at least the cutoff. */
  minimum: number;
  tag: string;
};

export type NicheContent = {
  id: 'roofing' | 'remodeling';
  published: boolean;
  /** Value stored on the lead and matched by the booking step. */
  offerLabel: string;
  meta: { title: string; description: string };
  pill: string;
  headlines: Record<HeadlineVariant, string>;
  subhead: CopySpan[];
  button: string;
  chips: string[];
  quietLine: string;
  video: { enabled: boolean; url: string };
  statsHeading: string;
  stats: StatCard[];
  statsFoot: string;
  problem: {
    eyebrow: string;
    heading: string;
    body: string;
    placesHeading: string;
    places: { title: string; text: string; icon: 'lead' | 'estimate' | 'inspection' }[];
    closing: string;
  };
  quotes: { enabled: boolean; items: { quote: string; attribution: string }[] };
  need: {
    heading: string;
    items: { title: string; text: string }[];
    foot: string;
  };
  offer: {
    eyebrow: string;
    heading: string;
    items: { title: string; bullets: string[]; done: string }[];
    /** Content setting. Inserted into the line under the four pieces. */
    timeEstimate: string;
    /** Content setting. The offer's weekly-review bullet. */
    weeklyReviewBullet: string;
  };
  why: {
    heading: string;
    body: string;
    checks: string[];
    after: string;
  };
  proof: { label: string; text: string; honesty: string };
  commitments: string[];
  fitHeading: string;
  fit: { title: string; text: string };
  notFit: { title: string; text: string };
  stepsHeading: string;
  steps: { title: string; body: string }[];
  /** Content setting. Body of the weekly-review step. */
  weeklyReview: string;
  faqHeading: string;
  /** Content setting. Appended to the price answer. */
  priceLine: string;
  /** Content setting. Off until the delivery promise should be said out loud. */
  deliveryCommitment: { enabled: boolean; line: string };
  faqs: { id?: 'price' | 'guarantee'; question: string; answer: string }[];
  finalCta: { heading: string; text: string };
  notYet: { title: string; body: string };
  /** Content setting. A spend band qualifies when its minimum is at least this many dollars. */
  qualificationCutoff: number;
  bookingLead: string;
  form: {
    heading: string;
    submit: string;
    firstName: string;
    phone: string;
    email: string;
    company: string;
    spendLabel: string;
    spendPlaceholder: string;
    options: SpendOption[];
  };
  sources: SourceRef[];
  sourcesNote: string;
  sourcesLabel: string;
};

export const ROOFING: NicheContent = {
  id: 'roofing',
  published: true,
  offerLabel: 'Roofing',
  meta: {
    title: 'Lead Leak Audit for Roofing Contractors | Divine Acquisition',
    description:
      'Free 30-minute Lead Leak Audit for roofing contractors who already pay for leads. See what happens after the lead comes in.',
  },
  pill: 'For roofing contractors running ads',
  headlines: {
    default:
      "We'll Find Where Your Roofing Leads And Estimates Go Quiet, Then Install The Follow-Up System That Fixes It Inside Your CRM, Completely Done For You In 14 Days, Without Hiring An Office Manager",
    c1: "How Fast Does A New Roofing Lead Hear From You? We'll Time It, Show You The Number, And Install The Fix Inside Your CRM In 14 Days, Completely Done For You",
    c2: "Your Cost Per Lead Isn't Your Cost Per Job. We'll Find Your Real Cost Per Booked Estimate And Install The Follow-Up That Stops Paid Leads Going To Waste, Completely Done For You In 14 Days",
    c3: "How Many Estimates Did You Send Last Month That Never Got A Second Call? We'll Count Them, Put A Dollar Number On It, And Install The Follow-Up That Gets Them Answered, Completely Done For You In 14 Days",
  },
  subhead: [
    {
      text: 'Roofing leads now cost roughly $107 to $228 each',
      sourceIds: ['lsa', 'search'],
    },
    {
      text: ', and homeowners say communication matters more than price',
      sourceIds: ['survey'],
    },
    {
      text: '. The free Lead Leak Audit shows what happens to yours after they come in.',
    },
  ],
  button: 'Book my free Lead Leak Audit',
  chips: ['Free audit', 'Done for you', 'You keep the findings'],
  quietLine: '30 minutes. No obligation.',
  video: { enabled: false, url: '' },
  statsHeading: 'What roofing leads cost right now',
  stats: [
    {
      value: '$107',
      label: 'Average cost per roofing lead on Google Local Services Ads, Q2 2026.',
      source: '99 Calls, agency client benchmarks (not guaranteed prices).',
      sourceId: 'lsa',
    },
    {
      value: '$228',
      label: 'Average cost per roofing lead on Google Search ads.',
      source: 'LocaliQ, 2025.',
      sourceId: 'search',
    },
    {
      value: '74%',
      label: 'of homeowners who hired a roofer rank responsiveness and communication above price.',
      source: 'Roofr homeowner survey of 292 people, 2026.',
      sourceId: 'survey',
    },
    {
      value: '$17,631',
      label: 'Average roof replacement in 2025.',
      source: 'Verisk 2026 U.S. Roof Report.',
      sourceId: 'verisk',
    },
  ],
  statsFoot: 'That is a lot of money riding on a phone call and a follow-up text.',
  problem: {
    eyebrow: 'You already know the problem...',
    heading: "You're paying for leads nobody finishes working.",
    body: "It usually isn't your ads, your price, or your crew. It's what happens in the hours and weeks after the lead comes in.",
    placesHeading: 'Three places roofing jobs quietly disappear',
    places: [
      {
        icon: 'lead',
        title: 'Paid leads that never really get worked',
        text: "A lead comes in while you're on a roof. One call attempt, no text, straight to voicemail. On shared leads, the homeowner may be hearing from several contractors at once.",
      },
      {
        icon: 'estimate',
        title: 'Estimates with no follow-up',
        text: "You spent hours on the inspection and the quote. Then the homeowner goes quiet, you get busy, and suddenly it's a month later.",
      },
      {
        icon: 'inspection',
        title: 'Missed calls and forgotten inspections',
        text: "Calls come in after hours or while you're on the job. Inspections get booked, then forgotten, and nobody reaches back out.",
      },
    ],
    closing: 'Each one is demand you already paid for.',
  },
  quotes: { enabled: false, items: [] },
  need: {
    heading: "A follow-up system that works while you're on the roof.",
    items: [
      {
        title: 'Every new lead gets a fast first reply.',
        text: 'A text goes out the moment a lead comes in, at any hour, and whoever is on gets an alert to call.',
      },
      {
        title: 'Every estimate gets followed up.',
        text: 'A follow-up sequence runs for weeks after the quote, in your voice, and stops when they reply or book.',
      },
      {
        title: 'Every booked inspection is protected.',
        text: 'Confirmations, reminders, a text-back when you miss a call, and a recovery sequence when someone no-shows.',
      },
    ],
    foot: 'Built inside the CRM you already use. You own all of it.',
  },
  offer: {
    eyebrow: "Here's what we install",
    heading: 'Four pieces, installed in 14 days, completely done for you.',
    timeEstimate: 'a few hours',
    weeklyReviewBullet: 'A weekly 30-minute review.',
    items: [
      {
        title: 'Lead intake and instant reply',
        bullets: [
          'One place where every lead source lands, tagged with where it came from.',
          'An instant text reply to every new lead.',
          'An alert and a call task for whoever is on.',
        ],
        done: 'A test lead from each source lands in your CRM, tagged, and triggers the text and the alert.',
      },
      {
        title: 'Estimate follow-up sequence',
        bullets: [
          'A multi-week follow-up that runs after every estimate.',
          'Written once in your voice, two rounds of edits.',
          'Stops automatically when the homeowner replies or books.',
        ],
        done: 'Every message is approved and the full sequence has been tested from start to finish.',
      },
      {
        title: 'Call and inspection protection',
        bullets: [
          'Confirmation and reminder messages before every inspection.',
          'A text-back when you miss a call.',
          'A recovery sequence for no-shows.',
        ],
        done: 'A test booking fires the full reminder chain and a simulated no-show fires the recovery messages.',
      },
      {
        title: 'Tracking and weekly numbers',
        bullets: [
          'Your starting numbers recorded before we begin.',
          'A simple dashboard: time to first reply, estimates sent, estimates followed up, inspections booked, inspections that showed.',
          'A weekly 30-minute review.',
        ],
        done: 'Your baseline is signed off and the dashboard shows the live numbers.',
      },
    ],
  },
  why: {
    heading: 'Why the audit is free',
    body: "We're early in roofing, so the audit is the proof. In 30 minutes we look at three things:",
    checks: [
      'How many minutes it takes for a new lead to hear from you.',
      'How many estimates went out last month without a second call.',
      "How many booked inspections didn't show, and what happened next.",
    ],
    after: 'You see the leaks and what they cost before you pay for anything.',
  },
  proof: {
    label: 'The one result we can show so far',
    text: 'A youth football coaching program went from a 20% close rate to 41% in 31 days, which added about $16,000 in monthly recurring revenue, after we launched their ads and fixed how their offer is communicated after the lead comes in.',
    honesty:
      'That is one client, one month, in a different industry. It is not a track record. You can ask to talk to him.',
  },
  commitments: [
    'The audit is free and you keep the findings either way.',
    'You own the messages and the system we install.',
    'We start with a limited pilot, not a long contract.',
  ],
  fitHeading: "Who it's for",
  fit: {
    title: 'A fit',
    text: 'Roofing companies that pay for leads (Meta, Google or Local Services Ads, Angi, HomeAdvisor, Thumbtack, lead vendors), spend at least $2,000 a month on them, send estimates, and want fewer of those leads wasted.',
  },
  notFit: {
    title: 'Not a fit',
    text: 'Companies with no paid leads, or no one sending estimates. Anyone looking for us to generate leads. Anyone who needs a guarantee of jobs.',
  },
  stepsHeading: 'How it works',
  weeklyReview:
    "We look at the numbers with you, including the weak weeks, and change the message that isn't working.",
  steps: [
    {
      title: 'Free audit, 30 minutes.',
      body: 'We time your reply, count the estimates with no second call, and look at what happens after a no-show. You keep the findings.',
    },
    {
      title: 'Install in 14 days.',
      body: 'We build the reply, the estimate follow-up and the inspection protection inside your CRM, and write every message in your voice for you to approve.',
    },
    {
      title: 'Weekly review.',
      body: "We look at the numbers with you, including the weak weeks, and change the message that isn't working.",
    },
  ],
  faqHeading: 'Questions',
  priceLine: 'Most single-problem installs land between $3,500 and $5,000.',
  deliveryCommitment: {
    enabled: false,
    line: "If we have not delivered the four pieces and passed the tests within 14 days of getting your access, you don't pay for the install.",
  },
  faqs: [
    {
      question: 'Do you generate my leads?',
      answer: 'No. We fix what happens after they arrive.',
    },
    {
      id: 'price',
      question: 'What does it cost?',
      answer:
        'The audit is free. Install pricing is quoted after the audit, once we see your numbers.',
    },
    {
      question: 'Will it sound like a robot?',
      answer: 'No. You approve every message and we write them in your voice. They read like a text from you, not a script.',
    },
    {
      question: 'I already have a CRM like JobNimbus, AccuLynx, GoHighLevel or Jobber. Do I need a new one?',
      answer:
        'In the audit we show you whether it makes sense to build inside the one you have or to set one up. Either way, you own it.',
    },
    {
      question: "Can't I just hire an office person?",
      answer:
        'A good office person helps, and we back them up. The system covers the gaps: after hours, busy days, and the estimate nobody has time to chase.',
    },
    {
      question: 'Agencies have burned me before. How is this different?',
      answer:
        "We don't sell leads and there is no long contract. We start with a free audit and a limited pilot. What we build is built in your account and it's yours to keep.",
    },
    {
      question: 'My leads are just junk.',
      answer:
        'Some may be. The audit separates bad leads from leads nobody worked, so you can judge your lead vendors with real numbers.',
    },
    {
      question: "I'm too busy right now.",
      answer: 'Busy stretches are exactly when follow-up slips. We do the building. You approve messages and give us access.',
    },
    {
      id: 'guarantee',
      question: 'Do you guarantee results?',
      answer:
        "We don't guarantee jobs, because we can't control your crew, your price, or the homeowner. What we commit to is the install: what we build, how it's tested, and the numbers we track.",
    },
    {
      question: "What's the catch?",
      answer:
        "There isn't one. The audit is how we show our work before you spend money. We're early in roofing, and we'd rather earn the install.",
    },
  ],
  finalCta: {
    heading: 'Find out where your leads are leaking.',
    text: '30 minutes. Free. You keep the findings either way.',
  },
  notYet: {
    title: 'Thanks.',
    body: "The audit works best once you're spending at least $2,000 a month on leads. We'll keep your details and reach out when it makes sense.",
  },
  qualificationCutoff: 2000,
  bookingLead: 'Pick a time for your free 30-minute Lead Leak Audit. You keep the findings either way.',
  form: {
    heading: 'Book your free Lead Leak Audit',
    submit: 'Continue to booking',
    firstName: 'First name',
    phone: 'Mobile phone',
    email: 'Email',
    company: 'Company name',
    spendLabel: 'About how much do you spend per month on paid leads?',
    spendPlaceholder: 'Select a range',
    options: [
      { label: 'Under $2,000', minimum: 0, tag: 'spend-under-2000' },
      { label: '$2,000 to $5,000', minimum: 2000, tag: 'spend-2000-5000' },
      { label: '$5,000 to $10,000', minimum: 5000, tag: 'spend-5000-10000' },
      { label: '$10,000 or more', minimum: 10000, tag: 'spend-10000-plus' },
    ],
  },
  sourcesLabel: 'Sources',
  sourcesNote: 'Most cost figures come from agency and vendor reports and are directional, not guarantees.',
  sources: [
    {
      id: 'lsa',
      n: 1,
      listing: '99 Calls, Google LSA cost per lead, Q2 2026 (agency client benchmarks).',
      href: 'https://99calls.com/blog/LSA-Lead-Cost-by-Industry-Q2',
    },
    {
      id: 'search',
      n: 2,
      listing: 'LocaliQ, Google Search cost per lead by industry, 2025.',
      href: 'https://localiq.com/blog/home-services-search-advertising-benchmarks/',
    },
    {
      id: 'survey',
      n: 3,
      listing:
        'Roofr, 2026 homeowner survey (292 US homeowners who hired a roofer in the last two years). Roofr sells roofing software.',
      href: 'https://roofr.com/blog/how-homeowners-choose-a-roofer',
    },
    {
      id: 'verisk',
      n: 4,
      listing: 'Verisk, 2026 U.S. Roof Report.',
      href: 'https://www.verisk.com/company/newsroom/roofing-reality-check-risk-is-rising-even-in-quiet-storm-years/',
    },
  ],
};

function mapStrings<T>(value: T, map: (text: string) => string): T {
  if (typeof value === 'string') return map(value) as T;
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, map)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = mapStrings(child, map);
    }
    return out as T;
  }
  return value;
}

function swapTrade(text: string): string {
  return text.replaceAll('Roofer', 'Remodeler').replaceAll('roofer', 'remodeler');
}

/**
 * Draft only. No route reads this until published is set true and a page is added.
 * Shared sections are the roofing copy with "roofer" swapped to "remodeler".
 * Ad headline variants were not supplied, so they repeat the one remodeling headline.
 */
export const REMODELING_DRAFT: NicheContent = (() => {
  const draft = mapStrings(ROOFING, swapTrade);
  draft.id = 'remodeling';
  draft.published = false;
  draft.offerLabel = 'Remodeling';
  draft.meta = {
    title: 'Lead Leak Audit for Remodeling Companies | Divine Acquisition',
    description:
      'Free 30-minute Lead Leak Audit for remodeling companies who already pay for leads. See what happens to the quotes you have already sent.',
  };
  draft.pill = 'For remodeling companies running ads';
  const headline =
    "We'll Find The Leads And Quotes That Went Quiet, Then Install The Follow-Up System That Brings Them Back Inside Your CRM, Completely Done For You In 14 Days, Without Hiring A Salesperson";
  draft.headlines = { default: headline, c1: headline, c2: headline, c3: headline };
  draft.subhead = [
    {
      text: 'Remodeling leads cost about $104 each on Google Local Services Ads',
      sourceIds: ['lsa'],
    },
    {
      text: ", and bigger projects are the ones homeowners are slowest to commit to. The free Lead Leak Audit shows what happens to the quotes you've already sent.",
    },
  ];
  draft.stats = [
    {
      value: '$104',
      label: 'Average cost per remodeling lead on Google Local Services Ads, Q2 2026.',
      source: '99 Calls, agency client benchmarks.',
      sourceId: 'lsa',
    },
    {
      value: '$518B',
      label: 'Expected homeowner remodeling and repair spending by the end of 2026.',
      source: 'Harvard JCHS Leading Indicator of Remodeling Activity, April 2026.',
      sourceId: 'jchs',
    },
    {
      value: 'More than 80%',
      label: 'of remodelers have fewer than five workers.',
      source: 'VerticalIQ, 2026.',
      sourceId: 'verticaliq',
    },
  ];
  draft.problem.places[1] = {
    icon: 'estimate',
    title: 'The quote you sent three weeks ago.',
    text: 'Design consults and proposals take hours to build, and the decision window runs weeks, so quotes go cold when nobody follows up.',
  };
  draft.sources = [
    {
      id: 'lsa',
      n: 1,
      listing: '99 Calls, Google LSA cost per lead, Q2 2026 (agency client benchmarks).',
      href: 'https://99calls.com/blog/LSA-Lead-Cost-by-Industry-Q2',
    },
    {
      id: 'jchs',
      n: 2,
      listing: 'Harvard JCHS Leading Indicator of Remodeling Activity, April 2026.',
      href: 'https://www.jchs.harvard.edu/press-releases/remodeling-growth-set-downshift-late-2026',
    },
    {
      id: 'verticaliq',
      n: 3,
      listing: 'VerticalIQ, residential remodelers, 2026.',
      href: 'https://verticaliq.com/product/residential-remodelers/',
    },
  ];
  return draft;
})();

export function headlineFor(content: NicheContent, variant: HeadlineVariant): string {
  return content.headlines[variant];
}

export function spendQualifies(option: SpendOption, cutoff = ROOFING.qualificationCutoff): boolean {
  return option.minimum >= cutoff;
}

export function spendOptionByLabel(
  content: NicheContent,
  label: string,
): SpendOption | undefined {
  return content.form.options.find((option) => option.label === label.trim());
}

export function offerFoot(content: NicheContent): string {
  return `You only approve the messages and give us access to your CRM. Expect ${content.offer.timeEstimate} of your time across the 14 days.`;
}

export function renderedSteps(content: NicheContent): { title: string; body: string }[] {
  return content.steps.map((step, index) =>
    index === 2 ? { title: step.title, body: content.weeklyReview } : step,
  );
}

export function renderedOffer(content: NicheContent): NicheContent['offer']['items'] {
  return content.offer.items.map((item, index) => {
    if (index !== 3) return item;
    const bullets = item.bullets.slice();
    if (bullets.length) bullets[bullets.length - 1] = content.offer.weeklyReviewBullet;
    return { ...item, bullets };
  });
}

export function renderedFaqs(content: NicheContent): { question: string; answer: string }[] {
  return content.faqs.map((item) => {
    if (item.id === 'price') {
      return { question: item.question, answer: `${item.answer} ${content.priceLine}` };
    }
    if (item.id === 'guarantee' && content.deliveryCommitment.enabled) {
      return { question: item.question, answer: `${item.answer} ${content.deliveryCommitment.line}` };
    }
    return { question: item.question, answer: item.answer };
  });
}

export function sourceById(content: NicheContent, id: string): SourceRef | undefined {
  return content.sources.find((source) => source.id === id);
}

export function sourceMark(content: NicheContent, ids: string[]): string {
  return ids
    .map((id) => sourceById(content, id)?.n)
    .filter((n): n is number => n != null)
    .join(', ');
}
