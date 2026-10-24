/**
 * AI Front Office copy. Pages read this file and do not own the words.
 * One shared page, plus a niche page whose published flag can fall back to shared.
 */
import { headlineVariantFromUtm, type HeadlineVariant } from './niche-tracking';

export type FrontOfficeWords = {
  lead: string;
  leads: string;
  job: string;
  jobs: string;
  quote: string;
  industry: string;
};

export type FrontOfficeHeadline = {
  before: string;
  highlight: string;
  after: string;
};

export type FrontOfficeCard = {
  title: string;
  text: string;
  example: true;
};

export type FrontOfficeChoice = {
  id: string;
  label: string;
  tag: string;
  minimum?: number;
};

export type FrontOfficeContent = {
  id: string;
  published: boolean;
  meta: { title: string; description: string };
  words: FrontOfficeWords;
  pill: string;
  headlines: Record<HeadlineVariant, FrontOfficeHeadline>;
  subhead: string;
  qualifier: string;
  button: string;
  terms: string[];
  leakHeading: string;
  exampleLabel: string;
  leaks: FrontOfficeCard[];
  calculator: {
    heading: string;
    valueLabel: string;
    missedLabel: string;
    percentLabel: string;
    percentDefault: number;
    resultAfter: string;
    estimate: string;
    foot: string;
  };
  buildHeading: string;
  buildItems: { title: string; text: string }[];
  buildFoot: string;
  stepsHeading: string;
  steps: { title: string; body: string }[];
  proof: {
    label: string;
    text: string;
    honesty: string;
    clientResult: { enabled: boolean; label: string; text: string; honesty: string };
  };
  fitHeading: string;
  industries: { id: string; label: string; href: string }[];
  fit: { title: string; text: string };
  notFit: { title: string; text: string };
  faqHeading: string;
  faqs: { id?: 'price'; question: string; answer: string }[];
  finalCta: { heading: string; text: string };
  notYet: { title: string; body: string };
  bookingLead: string;
  /** Content setting. Monthly revenue qualifies when the band minimum is at least this. */
  qualificationCutoff: number;
  /** Content setting. Turns the price line on in the FAQ and under the build section. */
  showPrice: boolean;
  priceLine: string;
  priceFoot: string;
  form: {
    heading: string;
    submit: string;
    firstName: string;
    phone: string;
    email: string;
    company: string;
    businessLabel: string;
    businessPlaceholder: string;
    businesses: { id: string; label: string }[];
    defaultBusinessId: string;
    revenueLabel: string;
    revenuePlaceholder: string;
    revenueOptions: FrontOfficeChoice[];
    leadsLabel: string;
    leadsPlaceholder: string;
    leadsOptions: FrontOfficeChoice[];
    leakLabel: string;
    leakPlaceholder: string;
    leakOptions: FrontOfficeChoice[];
  };
};

export type FrontOfficeApplication = FrontOfficeContent['form'] & {
  leaksByBusiness: Record<string, FrontOfficeChoice[]>;
};

export const FRONT_OFFICE_SETTINGS = {
  qualificationCutoff: 50_000,
  showPrice: true,
  priceLine: 'Builds start at $7,000.',
  priceFoot: 'Builds start at $7,000.',
} as const;

const REVENUE_OPTIONS: FrontOfficeChoice[] = [
  { id: 'under-50k', label: 'Under $50K', minimum: 0, tag: 'revenue - under 50k' },
  { id: '50k-100k', label: '$50K to $100K', minimum: 50_000, tag: 'revenue - 50k to 100k' },
  { id: '100k-250k', label: '$100K to $250K', minimum: 100_000, tag: 'revenue - 100k to 250k' },
  { id: '250k-plus', label: '$250K+', minimum: 250_000, tag: 'revenue - 250k plus' },
];

const LEADS_OPTIONS: FrontOfficeChoice[] = [
  { id: 'under-10', label: 'Under 10', tag: 'leads - under 10' },
  { id: '10-25', label: '10 to 25', tag: 'leads - 10 to 25' },
  { id: '25-50', label: '25 to 50', tag: 'leads - 25 to 50' },
  { id: '50-plus', label: '50+', tag: 'leads - 50 plus' },
];

export const FRONT_OFFICE_BUSINESSES = [
  { id: 'hvac', label: 'HVAC' },
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'roofing', label: 'Roofing' },
  { id: 'remodeling', label: 'Remodeling' },
  { id: 'lawn-care', label: 'Lawn care' },
  { id: 'pest-control', label: 'Pest control' },
  { id: 'cleaning', label: 'Cleaning' },
  { id: 'med-spa', label: 'Med spa' },
  { id: 'other', label: 'Other' },
] as const;

const GENERIC: FrontOfficeWords = {
  lead: 'lead',
  leads: 'leads',
  job: 'job',
  jobs: 'jobs',
  quote: 'quote',
  industry: 'home service and med spa',
};

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function pluralTitle(quote: string): string {
  const words = titleCase(quote).split(' ');
  const last = words.length - 1;
  words[last] = `${words[last]}s`;
  return words.join(' ');
}

function leakOptions(quote: string): FrontOfficeChoice[] {
  return [
    { id: 'missed-calls', label: 'Missed calls', tag: 'leak - missed calls' },
    { id: 'slow-replies', label: 'Slow replies', tag: 'leak - slow replies' },
    { id: 'quotes-quiet', label: `${pluralTitle(quote)} that go quiet`, tag: 'leak - quotes quiet' },
    { id: 'no-shows', label: 'No-shows', tag: 'leak - no shows' },
    { id: 'past-customers', label: 'Past customers never return', tag: 'leak - past customers' },
  ];
}

function sharedCards(): FrontOfficeCard[] {
  return [
    { title: 'After-hours calls', text: 'Called 7:40 PM. Voicemail. Booked someone else by 8.', example: true },
    { title: 'Quotes gone quiet', text: '$8,400 quote sent Tuesday. No follow-up.', example: true },
    { title: 'Past customers', text: '312 customers last year. 0 called back this year.', example: true },
  ];
}

function tradeCards(): FrontOfficeCard[] {
  return [
    {
      title: 'After-hours calls',
      text: 'AC out, called 9:15 PM. Voicemail. Booked the next company on the list.',
      example: true,
    },
    { title: 'Estimates gone quiet', text: '$11,200 system estimate sent Monday. No second call.', example: true },
    {
      title: 'Past customers',
      text: '640 service customers last year. No tune-up reminder sent.',
      example: true,
    },
  ];
}

function projectCards(quote: string): FrontOfficeCard[] {
  return [
    {
      title: 'After-hours calls',
      text: 'Storm week: 40 estimate requests. 13 got a call back the same day.',
      example: true,
    },
    {
      title: `${pluralTitle(quote)} gone quiet`,
      text: `$18,500 ${quote} sent two weeks ago. No follow-up.`,
      example: true,
    },
    {
      title: 'Past customers',
      text: "Last year's customers: 0 asked for a review or a referral.",
      example: true,
    },
  ];
}

function routeCards(): FrontOfficeCard[] {
  return [
    {
      title: 'After-hours calls',
      text: 'Quote request at 6:50 PM. Reply the next afternoon. Already hired someone.',
      example: true,
    },
    { title: 'Recurring plan', text: 'First visit done. Never offered a recurring plan.', example: true },
    { title: 'Past customers', text: '210 one-time customers. 0 brought back this season.', example: true },
  ];
}

function medSpaCards(): FrontOfficeCard[] {
  return [
    {
      title: 'After-hours calls',
      text: 'Consult request at 8:30 PM. Reply the next day. Booked elsewhere.',
      example: true,
    },
    {
      title: 'Treatment plans gone quiet',
      text: "Treatment plan presented. No follow-up after 'let me think about it'.",
      example: true,
    },
    { title: 'Past patients', text: '500 past patients. No rebooking reminder sent.', example: true },
  ];
}

function buildContent(input: {
  id: string;
  published: boolean;
  words: FrontOfficeWords;
  defaultBusinessId: string;
  leaks: FrontOfficeCard[];
}): FrontOfficeContent {
  const words = input.words;
  const lead = titleCase(words.lead);
  const job = titleCase(words.job);
  const quote = titleCase(words.quote);
  const industries = FRONT_OFFICE_BUSINESSES.filter((item) => item.id !== 'other').map((item) => ({
    id: item.id,
    label: item.label,
    href: `/acq/ai/${item.id}`,
  }));

  return {
    id: input.id,
    published: input.published,
    words,
    meta: {
      title:
        input.id === 'shared'
          ? 'AI Front Office | Divine Acquisition'
          : `AI Front Office for ${words.industry} | Divine Acquisition`,
      description: `AI answers missed calls and new ${words.leads} in seconds, follows up on every ${words.quote}, and shows your cost per booked ${words.job}.`,
    },
    pill: `For ${words.industry} owners doing $50K+/month`,
    headlines: {
      default: {
        before: 'We Build The AI Front Office That ',
        highlight: 'Answers, Books And Follows Up',
        after: ` On Every ${lead} (Live In 3 Weeks)`,
      },
      c1: { before: `Every Missed Call Is A ${job} Your Competitor Books`, highlight: '', after: '' },
      c2: { before: `Every ${quote} You Sent Last Month Deserves A Second Call`, highlight: '', after: '' },
      c3: { before: 'How Many Past Customers Did You Call Back This Year?', highlight: '', after: '' },
    },
    subhead: `AI answers missed calls and new ${words.leads} in seconds, follows up on every ${words.quote}, brings back past customers, and shows you your cost per booked ${words.job}. Built inside your own tools. You own all of it.`,
    qualifier: 'For owners with steady lead flow and a team or front desk taking calls.',
    button: 'GET YOUR FREE AI AUDIT',
    terms: ['Free audit, written blueprint', 'Live in 3 weeks', 'You own everything we build'],
    leakHeading: `You're not short on ${words.leads}. You're losing the ones you have.`,
    exampleLabel: 'Example',
    leaks: input.leaks,
    calculator: {
      heading: `What are missed ${words.leads} costing you?`,
      valueLabel: `Average ${words.job} value (dollars)`,
      missedLabel: `Missed or unanswered ${words.leads} per week`,
      percentLabel: 'How many of those would have booked (percent)',
      percentDefault: 30,
      resultAfter: `a month in ${words.jobs} you already paid to get.`,
      estimate: 'Estimate based on your numbers.',
      foot: `You already paid to get these ${words.leads}.`,
    },
    buildHeading: 'Your AI front office',
    buildItems: [
      { title: 'AI receptionist', text: 'Answers missed and after-hours calls, then books or routes them.' },
      { title: 'Speed-to-lead', text: `Every form and ad ${words.lead} gets a reply in seconds.` },
      { title: `${quote} follow-up`, text: `Every ${words.quote} followed up until it's a yes or a no.` },
      { title: 'Booking and reminders', text: 'Fewer no-shows, easy rescheduling.' },
      { title: 'Reviews engine', text: 'Asks every happy customer at the right moment.' },
      { title: 'Reactivation', text: 'Brings past customers back on a schedule.' },
      { title: 'Owner dashboard', text: `Cost per booked ${words.job}, by source, every week.` },
    ],
    buildFoot: "Your team approves every message template up front, so the AI only says what you've signed off on.",
    stepsHeading: 'How it works',
    steps: [
      { title: 'Free AI audit', body: `We map where ${words.leads} leak and send you a written blueprint.` },
      { title: 'Build', body: 'Live in 3 weeks, inside your phone system, CRM and calendar.' },
      { title: 'Train', body: 'Two training calls with your front desk or office team.' },
      { title: 'Tune', body: '30 days of adjustments against your numbers.' },
    ],
    proof: {
      label: 'Our own business',
      text: 'We run this same system in our own cleaning business before we build it for anyone else.',
      honesty: 'This describes our own cleaning business.',
      clientResult: { enabled: false, label: '', text: '', honesty: '' },
    },
    fitHeading: "Who it's for",
    industries,
    fit: {
      title: 'For you if',
      text: `You're doing $50K+ a month, ${words.leads} come in every week, and someone answers your phones.`,
    },
    notFit: {
      title: 'Not for you if',
      text: `You need more ${words.leads} first, or you're under $50K a month, where the build won't pay back fast enough.`,
    },
    faqHeading: 'Questions',
    faqs: [
      {
        question: 'Will AI talk to my customers?',
        answer: 'Only with messages your team approved, and it hands the conversation to a person when it should.',
      },
      {
        question: 'Do I need new software?',
        answer: "No. We build inside what you already use, or set up what's missing.",
      },
      {
        question: 'Who owns it?',
        answer: 'You do. The accounts, the phone numbers, the data, all of it.',
      },
      {
        question: "What if my team doesn't use it?",
        answer: 'Two training calls are included, and the dashboard shows who is following up.',
      },
      {
        question: 'Do you run ads?',
        answer: `No. We make sure the ${words.leads} you already get turn into booked ${words.jobs}.`,
      },
      {
        question: 'How long does it take?',
        answer: 'About 3 weeks to go live.',
      },
      {
        id: 'price',
        question: 'What does it cost?',
        answer: 'Your exact scope and price come out of the blueprint.',
      },
    ],
    finalCta: {
      heading: `Find out where your ${words.leads} leak. Free.`,
      text: 'One audit, one written blueprint. Yours to keep whether we work together or not.',
    },
    notYet: {
      title: "You're close.",
      body: "The AI front office pays off fastest once a business is doing about $50K a month. When you get there, come back and we'll map it for you.",
    },
    bookingLead: 'Pick a time for your free AI audit. You keep the written blueprint either way.',
    qualificationCutoff: FRONT_OFFICE_SETTINGS.qualificationCutoff,
    showPrice: FRONT_OFFICE_SETTINGS.showPrice,
    priceLine: FRONT_OFFICE_SETTINGS.priceLine,
    priceFoot: FRONT_OFFICE_SETTINGS.priceFoot,
    form: {
      heading: 'Get your free AI audit',
      submit: 'Continue',
      firstName: 'First name',
      phone: 'Mobile phone',
      email: 'Email',
      company: 'Company',
      businessLabel: 'What type of business do you run?',
      businessPlaceholder: 'Select a business',
      businesses: FRONT_OFFICE_BUSINESSES.map((item) => ({ id: item.id, label: item.label })),
      defaultBusinessId: input.defaultBusinessId,
      revenueLabel: "What's your monthly revenue?",
      revenuePlaceholder: 'Select a range',
      revenueOptions: REVENUE_OPTIONS,
      leadsLabel: `How many new ${words.leads} do you get a week?`,
      leadsPlaceholder: 'Select a range',
      leadsOptions: LEADS_OPTIONS,
      leakLabel: `Where do you lose the most ${words.jobs}?`,
      leakPlaceholder: 'Select one',
      leakOptions: leakOptions(words.quote),
    },
  };
}

export const SHARED_FRONT_OFFICE: FrontOfficeContent = buildContent({
  id: 'shared',
  published: true,
  words: GENERIC,
  defaultBusinessId: '',
  leaks: sharedCards(),
});

const NICHE_INPUTS: {
  id: string;
  published: boolean;
  words: FrontOfficeWords;
  leaks: FrontOfficeCard[];
}[] = [
  {
    id: 'hvac',
    published: true,
    words: { lead: 'service call', leads: 'service calls', job: 'job', jobs: 'jobs', quote: 'estimate', industry: 'HVAC' },
    leaks: tradeCards(),
  },
  {
    id: 'plumbing',
    published: true,
    words: {
      lead: 'service call',
      leads: 'service calls',
      job: 'job',
      jobs: 'jobs',
      quote: 'estimate',
      industry: 'plumbing',
    },
    leaks: tradeCards(),
  },
  {
    id: 'roofing',
    published: true,
    words: {
      lead: 'estimate request',
      leads: 'estimate requests',
      job: 'project',
      jobs: 'projects',
      quote: 'estimate',
      industry: 'roofing',
    },
    leaks: projectCards('estimate'),
  },
  {
    id: 'remodeling',
    published: true,
    words: {
      lead: 'estimate request',
      leads: 'estimate requests',
      job: 'project',
      jobs: 'projects',
      quote: 'proposal',
      industry: 'remodeling',
    },
    leaks: projectCards('proposal'),
  },
  {
    id: 'lawn-care',
    published: true,
    words: {
      lead: 'quote request',
      leads: 'quote requests',
      job: 'recurring customer',
      jobs: 'recurring customers',
      quote: 'quote',
      industry: 'lawn care',
    },
    leaks: routeCards(),
  },
  {
    id: 'pest-control',
    published: true,
    words: {
      lead: 'quote request',
      leads: 'quote requests',
      job: 'recurring customer',
      jobs: 'recurring customers',
      quote: 'quote',
      industry: 'pest control',
    },
    leaks: routeCards(),
  },
  {
    id: 'cleaning',
    published: true,
    words: {
      lead: 'quote request',
      leads: 'quote requests',
      job: 'recurring customer',
      jobs: 'recurring customers',
      quote: 'quote',
      industry: 'cleaning',
    },
    leaks: routeCards(),
  },
  {
    id: 'med-spa',
    published: true,
    words: {
      lead: 'consult request',
      leads: 'consult requests',
      job: 'patient',
      jobs: 'patients',
      quote: 'treatment plan',
      industry: 'med spa',
    },
    leaks: medSpaCards(),
  },
];

export const FRONT_OFFICE_NICHES: FrontOfficeContent[] = NICHE_INPUTS.map((item) =>
  buildContent({
    id: item.id,
    published: item.published,
    words: item.words,
    defaultBusinessId: item.id,
    leaks: item.leaks,
  }),
);

export function frontOfficeHeadlineVariant(
  contentParam: string | undefined,
  utmContent: string | undefined,
): HeadlineVariant {
  const named = (contentParam ?? '').trim();
  const fromNamed = headlineVariantFromUtm(named);
  if (named && fromNamed !== 'default') return fromNamed;
  return headlineVariantFromUtm(utmContent);
}

export function headlineText(headline: FrontOfficeHeadline): string {
  return `${headline.before}${headline.highlight}${headline.after}`;
}

export function frontOfficeFaqs(content: FrontOfficeContent): { question: string; answer: string }[] {
  return content.faqs.map((item) => {
    if (item.id === 'price' && content.showPrice) {
      return { question: item.question, answer: `${content.priceLine} ${item.answer}` };
    }
    return { question: item.question, answer: item.answer };
  });
}

export function frontOfficePriceFoot(content: FrontOfficeContent): string {
  return content.showPrice ? content.priceFoot : '';
}

export function resolveFrontOffice(
  slug?: string | null,
  catalog: FrontOfficeContent[] = FRONT_OFFICE_NICHES,
): { content: FrontOfficeContent; fallback: boolean } {
  const id = (slug ?? '').trim().toLowerCase();
  if (!id || id === 'shared') return { content: SHARED_FRONT_OFFICE, fallback: false };
  const match = catalog.find((item) => item.id === id);
  if (!match || !match.published) return { content: SHARED_FRONT_OFFICE, fallback: true };
  return { content: match, fallback: false };
}

export function frontOfficeBusiness(id: string): FrontOfficeContent | null {
  if (id === 'other') return SHARED_FRONT_OFFICE;
  return FRONT_OFFICE_NICHES.find((item) => item.id === id) ?? null;
}

export function leakCatalog(): Record<string, FrontOfficeChoice[]> {
  const catalog: Record<string, FrontOfficeChoice[]> = {
    shared: SHARED_FRONT_OFFICE.form.leakOptions,
    other: SHARED_FRONT_OFFICE.form.leakOptions,
  };
  for (const niche of FRONT_OFFICE_NICHES) catalog[niche.id] = niche.form.leakOptions;
  return catalog;
}

export function revenueQualifies(option: FrontOfficeChoice, cutoff: number): boolean {
  return (option.minimum ?? 0) >= cutoff;
}
