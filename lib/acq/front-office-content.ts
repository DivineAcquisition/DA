/**
 * AI Front Office copy. One page for every local service business.
 * Layout reads this file and does not own the words.
 */
import { headlineVariantFromUtm, type HeadlineVariant } from './niche-tracking';

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
  meta: { title: string; description: string };
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

export type FrontOfficeApplication = FrontOfficeContent['form'];

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

const LEAK_OPTIONS: FrontOfficeChoice[] = [
  { id: 'missed-calls', label: 'Missed calls', tag: 'leak - missed calls' },
  { id: 'slow-replies', label: 'Slow replies', tag: 'leak - slow replies' },
  { id: 'quotes-quiet', label: 'Quotes that go quiet', tag: 'leak - quotes quiet' },
  { id: 'no-shows', label: 'No-shows', tag: 'leak - no shows' },
  { id: 'past-customers', label: 'Past customers never return', tag: 'leak - past customers' },
];

export const SHARED_FRONT_OFFICE: FrontOfficeContent = {
  id: 'ai',
  meta: {
    title: 'AI Front Office | Divine Acquisition',
    description:
      'AI answers missed calls and new leads in seconds, follows up on every quote, and shows your cost per booked job.',
  },
  pill: 'For local service owners doing $50K+/month',
  headlines: {
    default: {
      before: 'We Build The AI Front Office That ',
      highlight: 'Answers, Books And Follows Up',
      after: ' On Every Lead (Live In 3 Weeks)',
    },
    c1: { before: 'Every Missed Call Is A Job Your Competitor Books', highlight: '', after: '' },
    c2: { before: 'Every Quote You Sent Last Month Deserves A Second Call', highlight: '', after: '' },
    c3: { before: 'How Many Past Customers Did You Call Back This Year?', highlight: '', after: '' },
  },
  subhead:
    'AI answers missed calls and new leads in seconds, follows up on every quote, brings back past customers, and shows you your cost per booked job. Built inside your own tools. You own all of it.',
  qualifier: 'For owners with steady lead flow and a team taking calls.',
  button: 'GET YOUR FREE AI AUDIT',
  terms: ['Free audit, written blueprint', 'Live in 3 weeks', 'You own everything we build'],
  leakHeading: "You're not short on leads. You're losing the ones you have.",
  exampleLabel: 'Example',
  leaks: [
    { title: 'After-hours calls', text: 'Called 7:40 PM. Voicemail. Hired someone else by 8.', example: true },
    { title: 'Quotes gone quiet', text: '$6,800 quote sent Tuesday. No follow-up.', example: true },
    { title: 'Past customers', text: '312 customers last year. 0 asked back this year.', example: true },
  ],
  calculator: {
    heading: 'What are missed leads costing you?',
    valueLabel: 'Average job value (dollars)',
    missedLabel: 'Missed or unanswered leads per week',
    percentLabel: 'How many of those would have booked (percent)',
    percentDefault: 30,
    resultAfter: 'a month in jobs you already paid to get.',
    estimate: 'Estimate based on your numbers.',
    foot: 'You already paid to get these leads.',
  },
  buildHeading: 'Your AI front office',
  buildItems: [
    { title: 'AI receptionist', text: 'Answers missed and after-hours calls, then books or routes them.' },
    { title: 'Speed-to-lead', text: 'Every form and ad lead gets a reply in seconds.' },
    { title: 'Quote follow-up', text: "Every quote followed up until it's a yes or a no." },
    { title: 'Booking and reminders', text: 'Fewer no-shows, easy rescheduling.' },
    { title: 'Reviews engine', text: 'Asks every happy customer at the right moment.' },
    { title: 'Reactivation', text: 'Brings past customers back on a schedule.' },
    { title: 'Owner dashboard', text: 'Cost per booked job, by source, every week.' },
  ],
  buildFoot: "Your team approves every message template up front, so the AI only says what you've signed off on.",
  stepsHeading: 'How it works',
  steps: [
    { title: 'Free AI audit', body: 'We map where your leads leak and send you a written blueprint.' },
    { title: 'Build', body: 'Live in 3 weeks, inside your phone system, CRM and calendar.' },
    { title: 'Train', body: 'Two training calls with your team.' },
    { title: 'Tune', body: '30 days of adjustments against your numbers.' },
  ],
  proof: {
    label: 'Our own business',
    text: 'We run this same system in our own service business before we build it for anyone else.',
    honesty: 'This describes our own service business.',
    clientResult: { enabled: false, label: '', text: '', honesty: '' },
  },
  fitHeading: "Who it's for",
  fit: {
    title: 'For you if',
    text: 'You run a local service business doing $50K+ a month, leads come in every week, and someone on your team answers the phones.',
  },
  notFit: {
    title: 'Not for you if',
    text: "You need more leads first, or you're under $50K a month, where the build won't pay back fast enough.",
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
      answer: 'No. We make sure the leads you already get turn into booked jobs.',
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
    heading: 'Find out where your leads leak. Free.',
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
    businessLabel: 'What type of service business do you run?',
    businessPlaceholder: 'A short description',
    revenueLabel: "What's your monthly revenue?",
    revenuePlaceholder: 'Select a range',
    revenueOptions: REVENUE_OPTIONS,
    leadsLabel: 'How many new leads do you get a week?',
    leadsPlaceholder: 'Select a range',
    leadsOptions: LEADS_OPTIONS,
    leakLabel: 'Where do you lose the most jobs?',
    leakPlaceholder: 'Select one',
    leakOptions: LEAK_OPTIONS,
  },
};

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

export function revenueQualifies(option: FrontOfficeChoice, cutoff: number): boolean {
  return (option.minimum ?? 0) >= cutoff;
}
