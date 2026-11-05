/**
 * Copy and links for the Divine Acquisition company site (app/site).
 * Everything a visitor reads on the homepage lives here, so the page
 * components only decide how it looks.
 */

export const SITE = {
  name: 'Divine Acquisition',
  legalName: 'Divine Acquisition™',
  /** Vercel redirects the bare domain to www, so www is the canonical address. */
  origin: 'https://www.divineacquisition.io',
  values: ['Devotion', 'Innovation', 'Value', 'Exclusivity'] as const,
  description:
    'Divine Acquisition helps established service businesses strengthen their sales operations and client experience. We diagnose what isn’t working, design the right processes, and implement the systems behind them.',
} as const;

/** Where "Book a diagnostic" goes. Same form the current site's "Get in touch" uses. */
export const BOOKING_URL = 'https://form.typeform.com/to/lvtP8G4E';
export const VISTRIAL_URL = 'https://vistrial.io';
export const CAREERS_URL = 'https://hiring.divineacquisition.io';

export const SOCIALS = [
  { id: 'x', label: 'X', href: 'https://x.com/MalikSannie' },
  { id: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@MalikSannie' },
  { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/maliksanniee/' },
] as const;

/* ------------------------------------------------------------------------ */
/* Navigation                                                                */
/* ------------------------------------------------------------------------ */

export type NavLink = {
  label: string;
  description: string;
  href: string;
  /** Opens another site. */
  external?: boolean;
  /** Shown but not clickable. */
  muted?: boolean;
  icon?: 'sales' | 'client' | 'vistrial' | 'more' | 'approach' | 'work' | 'philosophy' | 'founder' | 'fit';
  badge?: string;
};

export type NavGroup = { id: 'services' | 'products' | 'company'; label: string; links: NavLink[] };

export const NAV: NavGroup[] = [
  {
    id: 'services',
    label: 'Services',
    links: [
      {
        label: 'Sales Operations Build Out',
        description: 'Pipelines, CRM architecture, intake, qualification, and follow-up.',
        href: '#sales-operations',
        icon: 'sales',
      },
      {
        label: 'Client Experience & Retention Build Out',
        description: 'Onboarding, sales-to-service handoffs, communication, and retention.',
        href: '#client-experience',
        icon: 'client',
      },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    links: [
      {
        label: 'Vistrial™',
        description: 'Agentic software for market intelligence and evidence-backed opportunities.',
        href: VISTRIAL_URL,
        external: true,
        icon: 'vistrial',
        badge: 'In development',
      },
      {
        label: 'More from our lab',
        description: 'Further stages of the customer lifecycle, over time.',
        href: '#vistrial',
        icon: 'more',
        muted: true,
      },
    ],
  },
  {
    id: 'company',
    label: 'Company',
    links: [
      { label: 'Our Approach', description: 'Diagnose, architect, implement, validate, improve.', href: '#approach', icon: 'approach' },
      { label: 'Our Work', description: 'Practical improvements. Documented outcomes.', href: '#work', icon: 'work' },
      { label: 'Philosophy', description: 'The Divine Acquisition standard.', href: '#philosophy', icon: 'philosophy' },
      { label: 'Founder', description: 'A note from Malik Sannie.', href: '#founder', icon: 'founder' },
      { label: 'Who We Serve', description: 'Built for companies ready to improve.', href: '#who-we-serve', icon: 'fit' },
    ],
  },
];

/* ------------------------------------------------------------------------ */
/* Sections                                                                  */
/* ------------------------------------------------------------------------ */

export const HERO = {
  eyebrow: 'Management Consulting · Systems Implementation · Technology',
  headline: 'Build the Systems Behind Better Sales and Lasting Client Relationships.',
  lead: 'Divine Acquisition helps established service businesses strengthen their sales operations and client experience.',
  body: 'We examine what isn’t working, design the right processes, and implement the systems that help your team operate with greater clarity, consistency, and accountability.',
  primaryCta: 'Book a diagnostic',
  secondaryCta: 'Explore our services',
} as const;

export const PROBLEM = {
  id: 'problem',
  index: '02',
  eyebrow: 'The gap between activity and execution',
  headline: 'Your Business Is Moving. But Is Everything Moving Together?',
  sequence: [
    'An opportunity enters your pipeline.',
    'A sales conversation takes place.',
    'A proposal gets sent.',
    'A customer signs.',
  ],
  handoff: 'Then the work moves between people, departments, software, and responsibilities.',
  risk: 'That’s where important details can get lost.',
  symptoms:
    'Sales opportunities become difficult to track. Follow-ups are missed. Client onboarding becomes inconsistent. Leadership struggles to see what’s happening without asking the team.',
  notMore:
    'These aren’t always problems that more advertising, another employee, or additional software will solve.',
  rebuild: 'Sometimes, the underlying process needs to be rebuilt.',
  close: 'We help businesses identify and address those gaps.',
} as const;

export type Service = {
  id: string;
  index: string;
  name: string;
  headline: string;
  body: string[];
  builds: string[];
  cta: string;
};

export const SERVICES = {
  id: 'services',
  index: '03',
  eyebrow: 'Our services',
  headline: 'Two Critical Areas. One Connected Business.',
  items: [
    {
      id: 'sales-operations',
      index: '01',
      name: 'Sales Operations Build Out',
      headline: 'Make Every Opportunity Accountable.',
      body: [
        'We design and implement the processes behind your sales operation—from lead intake and qualification to sales conversations, proposals, and follow-up.',
        'Give your team clear responsibilities, connected information, and greater visibility into the opportunities they’re managing.',
      ],
      builds: [
        'Sales pipelines and CRM architecture',
        'Intake, qualification, and follow-up workflows',
        'Opportunity ownership and handoffs',
        'Sales reporting and operational visibility',
      ],
      cta: 'Explore sales operations',
    },
    {
      id: 'client-experience',
      index: '02',
      name: 'Client Experience & Retention Build Out',
      headline: 'The Relationship Doesn’t End When the Deal Closes.',
      body: [
        'We improve the processes that support customers after the sale.',
        'From onboarding and internal handoffs to communication, customer support, and retention, we help companies create a more consistent experience throughout the client lifecycle.',
      ],
      builds: [
        'Client onboarding and service workflows',
        'Sales-to-service handoff systems',
        'Communication and accountability processes',
        'Retention, reactivation, and client-success reporting',
      ],
      cta: 'Explore client experience',
    },
  ] satisfies Service[],
} as const;

export const APPROACH = {
  id: 'approach',
  index: '04',
  eyebrow: 'From understanding to implementation',
  headline: 'We Diagnose Before We Build.',
  lead: 'Technology should serve the business—not determine how the business operates.',
  body: 'Our engagements begin with understanding your company, your customers, your existing processes, and the constraints you’re trying to overcome.',
  steps: [
    { index: '01', name: 'Diagnose', body: 'Understand the business and identify the constraints worth addressing.', artifact: 'Constraints identified' },
    { index: '02', name: 'Architect', body: 'Design the processes, responsibilities, and technology required.', artifact: 'System blueprint' },
    { index: '03', name: 'Implement', body: 'Build and connect the agreed systems within your operation.', artifact: 'Systems connected' },
    { index: '04', name: 'Validate', body: 'Test the implementation, establish accountability, and train the people responsible.', artifact: 'Owners trained' },
    { index: '05', name: 'Improve', body: 'Review performance and determine where further improvements are justified.', artifact: 'Next priorities' },
  ],
  cta: 'Discuss your operations',
} as const;

export type CaseStudy = {
  client: string;
  industry: string;
  scope: string;
  timeframe: string;
  systems: string[];
  outcome: string;
  href?: string;
};

export const WORK = {
  id: 'work',
  index: '05',
  eyebrow: 'Our work',
  headline: 'Practical Improvements. Documented Outcomes.',
  lead: 'Our experience spans service businesses and specialized client operations.',
  body: 'Explore selected engagements to understand the problems we encountered, the systems involved, and the outcomes that could be documented.',
  /**
   * Add individually verified case studies here: business context, scope,
   * timeframe, and supporting results. Until there is at least one, the
   * section shows the engagement-file format with no figures in it.
   */
  caseStudies: [] as CaseStudy[],
  fields: ['Business context', 'Scope', 'Timeframe', 'Systems involved', 'Documented outcome'],
  pendingNote: 'Engagement files are published once each outcome has been verified with the client.',
} as const;

export const PHILOSOPHY = {
  id: 'philosophy',
  index: '06',
  eyebrow: 'The Divine Acquisition standard',
  headline: 'Build Something Worth Keeping.',
  body: [
    'We believe enduring businesses are built through more than acquisition.',
    'They’re built through the value they create, the promises they keep, and the systems that allow that value to continue.',
  ],
  intro: 'Four principles guide our work.',
  principles: [
    {
      numeral: 'I',
      name: 'Devotion',
      body: 'We take our responsibilities seriously. Our client’s needs, the quality of our work, and the integrity of our commitments come first.',
    },
    {
      numeral: 'II',
      name: 'Innovation',
      body: 'We question established processes and use technology intentionally to create better ways of operating.',
    },
    {
      numeral: 'III',
      name: 'Value',
      body: 'Our work should produce something useful, measurable where possible, and capable of supporting the business beyond the initial engagement.',
    },
    {
      numeral: 'IV',
      name: 'Exclusivity',
      body: 'We value depth, fit, and individual attention. We seek engagements where we can understand the business and deliver work appropriate to its particular needs.',
    },
  ],
  image: {
    src: '/site/marcus-aurelius.webp',
    width: 900,
    height: 1140,
    alt: 'White line drawing of a marble bust of Marcus Aurelius, fading into the page.',
    quote: 'Waste no more time arguing about what a good man should be. Be one.',
    quoteSource: 'Marcus Aurelius, Meditations',
    credit: 'Bust of Marcus Aurelius, Glyptothek Munich. Photo: Bibi Saint-Pol, public domain.',
  },
} as const;

export const FOUNDER = {
  id: 'founder',
  index: '07',
  eyebrow: 'A note from our founder',
  headline: 'Businesses Deserve More Than Another Collection of Tools.',
  paragraphs: [
    'I’m Malik Sannie, founder of Divine Acquisition.',
    'My experience in sales and operating service businesses shaped the way I think about growth.',
    'Acquiring customers matters. But what happens between the inquiry, the sale, and the ongoing client relationship matters just as much.',
    'I founded Divine Acquisition to work on the systems behind those experiences.',
    'Our ambition is to combine sound business judgment, thoughtful implementation, and emerging technology to help ambitious companies build stronger operations.',
  ],
  name: 'Malik Sannie',
  title: 'Founder, Divine Acquisition',
} as const;

export const VISTRIAL = {
  id: 'vistrial',
  index: '08',
  eyebrow: 'Technology developed by Divine Acquisition',
  headline: 'Meet Vistrial™',
  tagline: 'Understanding Precedes Advantage.',
  body: [
    'Vistrial is our agentic software platform in development.',
    'Its purpose is to help businesses transform relevant context, research, and operational knowledge into detailed, usable work.',
    'We’re building the platform around specialized agents, inspectable evidence, finished deliverables, and human approval.',
    'The first release focuses on market intelligence and evidence-backed business opportunities.',
    'Over time, we intend to expand its capabilities across additional stages of the customer lifecycle.',
  ],
  pillars: ['Specialized agents', 'Inspectable evidence', 'Finished deliverables', 'Human approval'],
  cta: 'Explore Vistrial',
} as const;

export const WHO = {
  id: 'who-we-serve',
  index: '09',
  eyebrow: 'Built for companies ready to improve',
  headline: 'The Right Systems Begin With the Right Partnership.',
  lead: 'We work best with established service businesses that:',
  criteria: [
    'Already have customers or an active sales pipeline.',
    'Recognize operational constraints affecting performance.',
    'Are willing to examine and improve existing processes.',
    'Want systems their teams can understand and maintain.',
    'Value thoughtful implementation over exaggerated promises.',
  ],
  close: 'We begin with a diagnostic to understand whether there’s a meaningful opportunity to work together.',
} as const;

export const FINAL = {
  id: 'diagnostic',
  index: '10',
  eyebrow: 'Let’s examine your operations',
  headline: 'Find the Gaps Worth Fixing.',
  body: [
    'Before recommending a new system, we want to understand the one you already have.',
    'Book a diagnostic to discuss your sales operation, client experience, and the constraints affecting your business.',
    'We’ll determine whether there’s a practical implementation opportunity and what the next step should be.',
  ],
  cta: 'Book a diagnostic',
} as const;

/* ------------------------------------------------------------------------ */
/* Tools shown in the system map and the logo strip                          */
/* ------------------------------------------------------------------------ */

export type Tool = { id: string; name: string; src: string };

const tool = (id: string, name: string, ext = 'svg'): Tool => ({ id, name, src: `/site/tools/${id}.${ext}` });

export const TOOLS = {
  meta: tool('meta', 'Meta Ads'),
  googleAds: tool('google-ads', 'Google Ads'),
  linkedin: tool('linkedin', 'LinkedIn'),
  analytics: tool('google-analytics', 'Google Analytics'),
  gohighlevel: tool('gohighlevel', 'GoHighLevel'),
  hubspot: tool('hubspot', 'HubSpot'),
  salesforce: tool('salesforce', 'Salesforce'),
  calendly: tool('calendly', 'Calendly'),
  calendar: tool('google-calendar', 'Google Calendar'),
  slack: tool('slack', 'Slack'),
  gmail: tool('gmail', 'Gmail'),
  whatsapp: tool('whatsapp', 'WhatsApp'),
  stripe: tool('stripe', 'Stripe'),
  quickbooks: tool('quickbooks', 'QuickBooks'),
  sheets: tool('google-sheets', 'Google Sheets'),
  airtable: tool('airtable', 'Airtable'),
  notion: tool('notion', 'Notion'),
  zapier: tool('zapier', 'Zapier'),
  make: tool('make', 'Make'),
  n8n: tool('n8n', 'n8n'),
  claude: tool('claude', 'Claude'),
  openai: tool('openai', 'ChatGPT'),
  gemini: tool('gemini', 'Gemini'),
  perplexity: tool('perplexity', 'Perplexity'),
  youtube: tool('youtube', 'YouTube'),
  tiktok: tool('tiktok', 'TikTok'),
} as const;

export const TOOL_STRIP: Tool[] = [
  TOOLS.meta,
  TOOLS.googleAds,
  TOOLS.linkedin,
  TOOLS.gohighlevel,
  TOOLS.hubspot,
  TOOLS.salesforce,
  TOOLS.calendly,
  TOOLS.slack,
  TOOLS.gmail,
  TOOLS.stripe,
  TOOLS.quickbooks,
  TOOLS.airtable,
  TOOLS.notion,
  TOOLS.zapier,
  TOOLS.make,
  TOOLS.n8n,
  TOOLS.claude,
  TOOLS.openai,
  TOOLS.gemini,
  TOOLS.perplexity,
];

/** Left of the hub: where opportunities come from. */
export const SYSTEM_SOURCES = [
  { label: 'Paid social', detail: 'Lead forms', tools: [TOOLS.meta] },
  { label: 'Search', detail: 'Call & form leads', tools: [TOOLS.googleAds] },
  { label: 'Outbound & referral', detail: 'Profiles & intros', tools: [TOOLS.linkedin, TOOLS.gmail] },
  { label: 'Website', detail: 'Inquiries & bookings', tools: [TOOLS.analytics, TOOLS.calendly] },
];

/** Right of the hub: where the work lands inside the business. */
export const SYSTEM_OUTPUTS = [
  { label: 'Pipeline & ownership', detail: 'Every opportunity has an owner', tools: [TOOLS.gohighlevel, TOOLS.hubspot, TOOLS.salesforce] },
  { label: 'Follow-up & scheduling', detail: 'Nothing waits on memory', tools: [TOOLS.calendar, TOOLS.calendly, TOOLS.whatsapp] },
  { label: 'Sales-to-service handoff', detail: 'Context travels with the client', tools: [TOOLS.slack, TOOLS.notion, TOOLS.airtable] },
  { label: 'Billing & reporting', detail: 'Leadership sees it without asking', tools: [TOOLS.stripe, TOOLS.quickbooks, TOOLS.sheets] },
];

export const SYSTEM_AI = [TOOLS.claude, TOOLS.openai, TOOLS.gemini, TOOLS.perplexity];
export const SYSTEM_AUTOMATION = [TOOLS.zapier, TOOLS.make, TOOLS.n8n];

export const SYSTEM_STATUSES = [
  'New inquiry captured · routed to its owner',
  'Qualification recorded · follow-up scheduled',
  'Proposal sent · reminder queued for day 3',
  'Agreement signed · onboarding workflow started',
  'Handoff logged · client success notified',
  'Weekly pipeline report delivered to leadership',
] as const;
