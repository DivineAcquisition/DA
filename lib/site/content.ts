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

/** The Sales Operations Diagnostic request form: the site's primary conversion. */
export const DIAGNOSTIC_PATH = '/diagnostic';
/** Booking step after the request. */
export const DIAGNOSTIC_BOOK_PATH = '/diagnostic/book';
/** Pre-discovery questionnaire, sent after a diagnostic is booked. */
export const DISCOVERY_PATH = '/discovery';
/** Current privacy policy for Divine Acquisition forms. */
export const PRIVACY_URL = 'https://acq.divineacquisition.io/privacy';
export const CONTACT_EMAIL = 'malik@divineacquisition.io';
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
  icon?: 'sales' | 'b2b' | 'local' | 'vistrial' | 'more' | 'approach' | 'work' | 'philosophy' | 'founder' | 'fit';
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
        description: 'From the first opportunity to the next sale.',
        href: '#sales-operations',
        icon: 'sales',
      },
      {
        label: 'B2B Service Companies & Agencies',
        description: 'Keep every opportunity moving beyond the discovery call.',
        href: '#b2b',
        icon: 'b2b',
      },
      {
        label: 'High-End Local Service Businesses',
        description: 'Stop letting valuable estimates go quiet.',
        href: '#local-services',
        icon: 'local',
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
      { label: 'About', description: 'Understanding before intervention.', href: '#about', icon: 'philosophy' },
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

export const SALES_OPS = {
  id: 'services',
  index: '03',
  eyebrow: 'Our core service',
  name: 'Sales Operations Build Out',
  positioning: 'From the First Opportunity to the Next Sale.',
  positioningBody:
    'We diagnose, design, and implement the systems that help service businesses manage opportunities, follow up consistently, maintain pipeline visibility, and identify valuable future customer opportunities.',
  headline: 'Your Team Shouldn’t Have to Guess What Happens Next.',
  body: [
    'We design and implement the infrastructure behind your sales process—from lead qualification and follow-up to pipeline management, accountability, and future customer opportunities.',
    'Our work connects the people, processes, and technologies your business depends on to manage sales activity with greater consistency and clarity.',
  ],
  builds: [
    {
      index: '01',
      name: 'Lead Intake & Qualification',
      body: 'Establish clear processes for capturing, organizing, qualifying, and assigning sales opportunities.',
    },
    {
      index: '02',
      name: 'Sales Follow-Up & Conversion',
      body: 'Build the workflows that support consistent outreach, appointment management, proposal follow-up, and opportunity progression.',
    },
    {
      index: '03',
      name: 'Pipeline Visibility & Accountability',
      body: 'Create the CRM structure, reporting, and responsibilities that help teams understand where opportunities stand and what needs to happen next.',
    },
    {
      index: '04',
      name: 'Reactivation & Expansion',
      body: 'Build appropriate processes for reconnecting with dormant opportunities, following up after a sale, and identifying renewal, referral, or expansion opportunities.',
    },
  ],
  supporting: 'Built Around Your Business. Designed for Your Team.',
  cta: 'Book your Sales Operations diagnostic',
  scopeTitle: 'Service scope',
  scopeIntro: 'Depending on the approved Statement of Work, implementation may include:',
  scope: [
    'CRM configuration',
    'Pipeline architecture',
    'Lead qualification and routing',
    'Follow-up processes',
    'Proposal and estimate tracking',
    'Sales accountability systems',
    'Reporting dashboards',
    'Appropriate automation and AI integrations',
    'Customer reactivation workflows',
    'Team training and operating documentation',
  ],
  scopeNote: 'These are possible deliverables, not a guarantee that every engagement includes all items.',
  marketsIntro: 'One methodology, implemented to fit how each market actually sells.',
  markets: [
    {
      id: 'b2b',
      label: 'B2B Service Companies & Specialized Agencies',
      headline: 'Keep Every Opportunity Moving Beyond the Discovery Call.',
      body: [
        'Complex service sales require more than a contact record.',
        'We help B2B service companies establish the processes behind qualification, discovery, proposal management, follow-up, and pipeline accountability.',
      ],
      journey: ['Inquiry', 'Discovery', 'Proposal', 'Decision', 'Contract', 'Expansion'],
      priorities: [
        'Qualification and discovery processes',
        'CRM and opportunity management',
        'Proposal follow-up',
        'Salesperson accountability',
        'Pipeline visibility',
        'Renewal and expansion tracking',
      ],
    },
    {
      id: 'local-services',
      label: 'High-End Local Service Businesses',
      headline: 'Stop Letting Valuable Estimates Go Quiet.',
      body: [
        'When your team is busy serving customers, valuable inquiries and estimates can lose momentum.',
        'We build the sales processes that support timely response, consistent follow-up, clearer ownership, and greater visibility into the opportunities your business has already generated.',
      ],
      journey: ['Inquiry', 'Qualification', 'Estimate', 'Follow-up', 'Booking', 'Referral'],
      priorities: [
        'Lead-response processes',
        'Estimate and proposal follow-up',
        'Appointment tracking',
        'CRM organization',
        'Sales activity visibility',
        'Customer reactivation and referrals',
      ],
    },
  ],
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

export const ABOUT = {
  id: 'about',
  index: '06',
  eyebrow: 'About Divine Acquisition',
  headline: 'We Believe the Greatest Creations Are Built to Endure.',
  lead: 'Divine Acquisition was founded on a conviction: innovation should create value beyond the moment of its creation.',
  body: [
    'Businesses deserve more than temporary fixes and disconnected technologies. They deserve thoughtful systems, disciplined execution, and partners willing to understand the people and responsibilities behind the work.',
    'We bring together management consulting, operational design, and technology to strengthen the systems behind sales and commercial execution—so ambitious founders can build organizations that are more capable, more deliberate, and better equipped to serve.',
  ],
  measure:
    'A business is not measured solely by what it acquires. It is also measured by what it builds, what it preserves, and the value it leaves behind.',
  central: { top: 'Understanding Before Intervention.', bottom: 'Stewardship After Implementation.' },
  centralLabel: 'Our central philosophy',
  statement: {
    headline: 'Innovation Without Understanding Creates Complexity.',
    lines: ['Technology without judgment creates dependency.', 'Ambition without discipline creates fragility.'],
    close:
      'Meaningful innovation requires clarity of purpose, sound judgment, and responsibility for the consequences of our work.',
  },
  principlesLabel: 'Four founding principles',
  principles: [
    {
      numeral: 'I',
      name: 'Devotion',
      body: 'Genuine commitment to the needs, people, and long-term well-being of the businesses we serve. Our responsibility extends beyond the system to the people who depend on it.',
    },
    {
      numeral: 'II',
      name: 'Innovation',
      body: 'Not technology for its own sake, but the disciplined application of better ideas, methods, and systems to meaningful problems.',
    },
    {
      numeral: 'III',
      name: 'Value',
      body: 'Our work is measured by its usefulness: improvements a business can understand, operate, measure, and sustain.',
    },
    {
      numeral: 'IV',
      name: 'Exclusivity',
      body: 'Exceptional work requires attention and honest selectivity. Exclusivity is earned through the quality of our commitments, not manufactured scarcity.',
    },
  ],
  image: {
    src: '/site/marcus-aurelius.webp',
    width: 900,
    height: 1140,
    alt: 'White line drawing of a marble bust of Marcus Aurelius, fading into the page.',
    caption: 'Our thinking draws on Marcus Aurelius and the Stoics: duty, disciplined judgment, and acting for the benefit of others.',
    credit: 'Bust of Marcus Aurelius, Glyptothek Munich. Photo: Bibi Saint-Pol, public domain.',
  },
} as const;

export const FOUNDER = {
  id: 'founder',
  index: '07',
  eyebrow: 'From our founder',
  headline: 'To Create Is a Gift. To Create Value Is a Responsibility.',
  paragraphs: [
    'I’ve always believed that the ability to create something meaningful is one of the greatest gifts we possess.',
    'But creation alone is not enough.',
    'What matters is what we choose to build, why we build it, and whether it genuinely improves the lives of the people it reaches.',
    'My study of philosophy, particularly the writings of Marcus Aurelius, has continually brought me back to the importance of duty, discipline, judgment, and responsibility.',
    'Ambition without these qualities can produce impressive things that ultimately serve very little purpose.',
    'I founded Divine Acquisition with the belief that innovation should be guided by something greater than novelty or personal success.',
    'Our work should make businesses more capable. It should help founders see their operations more clearly, strengthen the experiences they provide, and create value that extends beyond a single transaction.',
    'I want Divine Acquisition to be recognized not simply for what it builds, but for the devotion and thoughtfulness with which it serves.',
    'We will continue to pursue innovation. We will continue to challenge conventional methods. And we will remain selective about the work we undertake.',
    'But the quality of our judgment, the integrity of our commitments, and the well-being of those we serve must remain central.',
    'Because the greatest measure of our work is not merely what we create for ourselves, but what our creations make possible for others.',
  ],
  name: 'Malik Sannie',
  title: 'Founder, Divine Acquisition™',
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
