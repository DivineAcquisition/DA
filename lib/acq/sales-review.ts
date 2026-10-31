import {
  NICHE_PASSTHROUGH_KEYS,
  NICHE_TRACKING_KEYS,
  type NicheVisit,
  type NicheVisitKey,
} from '@/lib/acq/niche-tracking';

export const SALES_REVIEW_PATH = '/operations';
export const SALES_REVIEW_URL = 'https://acq.divineacquisition.io/operations';

export const SALES_REVIEW = {
  pill: 'For established B2B service businesses',
  headlineBefore: "Your Sales Team Shouldn't Have to Hold Your ",
  headlineAccent: 'Entire Pipeline Together.',
  lead: 'Divine Acquisition designs and implements the systems behind your sales operations.',
  support:
    'From lead intake and follow-up to pipeline tracking and team handoffs, we connect your existing tools and workflows so opportunities are managed consistently, and leadership knows what is happening.',
  cta: 'Request a sales operations review',
  builtAround: 'Built around your existing team, software, and sales process.',
  solve: {
    eyebrow: 'What we solve',
    title: "Revenue doesn't only leak at the point of sale.",
    intro: 'Opportunities can stall long before a buyer makes a decision.',
    close: 'We identify the breakdowns and implement the systems needed to address them.',
    items: [
      {
        title: 'Leads without ownership',
        body: 'New inquiries enter the business without a clearly assigned next action.',
      },
      {
        title: 'Follow-ups that go quiet',
        body: "Sales calls happen, but opportunities aren't consistently progressed.",
      },
      {
        title: 'Disconnected systems',
        body: 'Important information sits across CRMs, calendars, call recordings, and team notes.',
      },
      {
        title: 'Limited management visibility',
        body: "Leadership can't reliably see which deals need attention.",
      },
    ],
  },
  implement: {
    eyebrow: 'What we implement',
    title: 'Revenue infrastructure built around your business.',
    items: [
      {
        index: '01',
        title: 'Lead intake and routing',
        body: 'Capture, organize, and assign opportunities within your existing sales process.',
      },
      {
        index: '02',
        title: 'Pipeline and follow-up operations',
        body: 'Establish structured workflows for ownership, follow-up, proposals, and next steps.',
      },
      {
        index: '03',
        title: 'Sales intelligence and visibility',
        body: 'Create a clearer view of sales activity, opportunity status, and the information your team needs to move deals forward.',
      },
      {
        index: '04',
        title: 'Systems integration',
        body: "Connect the appropriate tools, data, and workflows so your team isn't constantly moving information manually.",
      },
    ],
  },
  approach: {
    eyebrow: 'Our approach',
    title: 'Diagnose. Design. Implement.',
    items: [
      {
        index: '01',
        title: 'Diagnose',
        body: 'We review your existing sales process, systems, and operational constraints.',
      },
      {
        index: '02',
        title: 'Design',
        body: 'We develop a practical implementation blueprint around the problems worth solving.',
      },
      {
        index: '03',
        title: 'Implement',
        body: 'We configure, connect, and test the agreed systems within your existing environment.',
      },
      {
        index: '04',
        title: 'Handoff and improve',
        body: 'We document the implementation, train the relevant team members, and establish how performance will be monitored.',
      },
    ],
  },
  who: {
    eyebrow: 'Who we work with',
    title: 'Built for businesses that already have something working.',
    intro: 'Divine Acquisition is designed for established B2B companies that:',
    points: [
      'Have a proven offer and existing customers.',
      'Generate sales opportunities through an established acquisition process.',
      'Sell through discovery calls, consultations, demos, or proposals.',
      'Want greater consistency, visibility, and control as they grow.',
    ],
    close:
      'We improve the systems behind an existing operation. We do not require you to replace your entire technology stack.',
  },
  close: {
    eyebrow: 'Start with a diagnostic',
    title: 'Find out where your sales process is breaking down.',
    body: "We'll discuss your current process, identify potential operational constraints, and determine whether a systems implementation would be worthwhile.",
    outline:
      'Qualified businesses receive a prioritized implementation outline showing what we recommend addressing first.',
  },
  form: {
    name: 'Your name',
    email: 'Work email',
    phone: 'Mobile phone',
    company: 'Company',
    process: 'Where does the sales process break down today?',
    submit: 'Request your sales operations review',
    pending: 'Sending your request',
    successTitle: 'Request received.',
    successBody:
      "We'll follow up to discuss your current process and whether a systems implementation would be worthwhile.",
  },
  consent:
    'I agree to receive calls and text messages from Divine Acquisition LLC and team members of Divine Acquisition about my sales operations review. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help.',
  meta: {
    title: 'Sales Operations Review | Divine Acquisition',
    description:
      'Divine Acquisition designs and implements the systems behind your sales operations, from lead intake and follow-up to pipeline tracking and team handoffs.',
  },
} as const;

export type SalesReviewLead = {
  firstName: string;
  email: string;
  phone: string;
  company: string;
  process: string;
  visit: NicheVisit;
};

export type SalesReviewParse =
  | { ok: true; lead: SalesReviewLead }
  | { ok: false; error: string; field?: string };

const VISIT_KEYS = new Set<string>([...NICHE_TRACKING_KEYS, ...NICHE_PASSTHROUGH_KEYS]);

function text(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

function visitFrom(body: Record<string, unknown>): NicheVisit {
  const raw = body.visit;
  if (!raw || typeof raw !== 'object') return {};
  const visit: NicheVisit = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!VISIT_KEYS.has(key) || typeof value !== 'string') continue;
    const clean = value.trim().slice(0, 300);
    if (clean) visit[key as NicheVisitKey] = clean;
  }
  return visit;
}

export function parseSalesReview(body: unknown): SalesReviewParse {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request.' };
  }
  const record = body as Record<string, unknown>;
  if (text(record, 'website')) return { ok: false, error: 'honeypot' };

  const firstName = text(record, 'firstName');
  const email = text(record, 'email');
  const phone = text(record, 'phone');
  const company = text(record, 'company');
  const process = text(record, 'process');
  const smsConsent = record.smsConsent === true;

  if (firstName.length < 2) return { ok: false, error: 'Enter your name.', field: 'firstName' };
  if ((phone.match(/\d/g)?.length ?? 0) < 10) {
    return { ok: false, error: 'Enter a valid mobile phone.', field: 'phone' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Enter a valid email.', field: 'email' };
  }
  if (company.length < 2) return { ok: false, error: 'Enter your company name.', field: 'company' };
  if (process.length < 12) {
    return { ok: false, error: 'Tell us where the sales process breaks down.', field: 'process' };
  }
  if (!smsConsent) {
    return { ok: false, error: 'Agree to calls and texts to continue.', field: 'smsConsent' };
  }

  return {
    ok: true,
    lead: { firstName, email, phone, company, process, visit: visitFrom(record) },
  };
}

export function salesReviewNote(lead: SalesReviewLead): string {
  const lines = [
    'Page: sales operations review',
    `Company: ${lead.company}`,
    `Process: ${lead.process}`,
  ];
  for (const [key, value] of Object.entries(lead.visit)) {
    if (value) lines.push(`${key}: ${value}`);
  }
  return lines.join('\n');
}
