export type DepartmentId = 'operations' | 'growth' | 'sales' | 'client-success';
export type LocationId = 'remote' | 'us-md';

export type RoleSection = {
  title: string;
  items: string[];
};

export type ApplyMethod =
  | { kind: 'airtable'; src: string }
  | { kind: 'external'; href: string }
  | { kind: 'form' };

export type RoleDetail = {
  mission: string;
  type: string;
  compensation: string;
  techStack?: string[];
  sections: RoleSection[];
  apply: ApplyMethod;
};

export type Role = {
  slug: string;
  title: string;
  subtitle: string;
  department: DepartmentId;
  departmentLabel: string;
  /** Copy shown on the board card. */
  summary: string;
  /** Copy shown in the role hero. */
  description: string;
  locations: LocationId[];
  tags: string[];
  level: 1 | 2 | 3 | 4;
  seoDescription: string;
  /** Roles that own a bespoke page skip the generic `[slug]` template. */
  href?: string;
  featured?: boolean;
  detail?: RoleDetail;
};

export const departments: { id: DepartmentId | 'all'; name: string }[] = [
  { id: 'all', name: 'View all' },
  { id: 'operations', name: 'Operations' },
  { id: 'growth', name: 'Growth & Marketing' },
  { id: 'sales', name: 'Sales' },
  { id: 'client-success', name: 'Client Success' },
];

export const locations: { id: LocationId; name: string }[] = [
  { id: 'remote', name: 'Remote' },
  { id: 'us-md', name: 'United States, MD' },
];

export const levelLabels: Record<number, string> = {
  1: 'Entry',
  2: 'Mid',
  3: 'Senior',
  4: 'Lead',
};

export const roles: Role[] = [
  {
    slug: 'sdr-placement',
    href: '/hiring/sdr-placement',
    title: 'SDR Placement Role',
    subtitle: 'Placement Program',
    department: 'sales',
    departmentLabel: 'Sales',
    summary:
      'We train you, certify you, and place you inside a real business where one job is yours: nobody who reaches out ever gets ignored.',
    description:
      'We train you, certify you, and place you inside a real business where one job is yours: nobody who reaches out ever gets ignored.',
    locations: ['remote'],
    tags: ['Remote', 'Full-time', 'Training provided'],
    level: 1,
    featured: true,
    seoDescription:
      "We're hiring operators, not virtual assistants. Get trained, certified, and placed inside a real business as a Sales Development Representative. $400 to $600 a month base, plus commission on every appointment you book. Remote, full-time, paid twice a month.",
  },
  {
    slug: 'system-integrator',
    title: 'Systems Architect',
    subtitle: 'Infrastructure',
    department: 'operations',
    departmentLabel: 'Operations',
    summary:
      'Turn strategy into infrastructure — pipelines, automations, and integrations across GHL, Zapier, Make, and APIs.',
    description:
      'Builder of machines. Take strategy and turn it into infrastructure — the pipelines, automations, and integrations that make everything work.',
    locations: ['remote', 'us-md'],
    tags: ['United States, MD', 'EST', 'Remote'],
    level: 3,
    seoDescription:
      'Join Divine Acquisition as a Systems Architect. Build pipelines, automations, workflows, and integrations using GHL, Zapier, Make, and APIs. Remote position with project-based and retainer compensation.',
    detail: {
      mission:
        'Build systems that create repeatable excellence. Every automation serves a human outcome — clarity over complexity, every time.',
      type: 'Full-time',
      compensation: 'Project + Retainer',
      techStack: ['GoHighLevel', 'Zapier', 'Make', 'Airtable', 'APIs', 'Webhooks', 'Framer'],
      apply: { kind: 'airtable', src: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pagPWbnh31lQsrT7C/form' },
      sections: [
        {
          title: 'Responsibilities',
          items: [
            'Translate business requirements into clean technical specs and system architectures',
            'Build GHL sub-accounts: pipelines, workflows, automations, triggers, dashboards',
            'Wire Zapier / Make integrations between GHL and Airtable, Stripe, calendars',
            'Ship landing, VSL, and booking pages — fast-loading, mobile-first',
            'QA every build — walk every path, trigger, and edge case before delivery',
            'Document with Loom walkthroughs; resolve live issues within 24 hours',
          ],
        },
        {
          title: 'Requirements',
          items: [
            'Deep technical fluency — GHL, Zapier, Make, APIs, webhooks',
            'Systems thinking — you see logic flows, not just buttons',
            'Quality obsession — "good enough" doesn\'t sit right',
            'Independent problem-solving without hand-holding',
            'Documentation discipline — future-you will thank you',
          ],
        },
        {
          title: 'What Success Looks Like',
          items: [
            '95%+ on-time, on-spec delivery',
            'Zero critical errors — testing checklist passed before delivery',
            '100% of builds documented with Loom walkthroughs',
            'Live issues resolved within 24 hours',
          ],
        },
        {
          title: 'Compensation',
          items: [
            'Project-based: $75–$400 per build, scaled by complexity',
            'Retainer option: $1,000–$2,500/mo for ongoing builds + maintenance',
            'Bonuses for on-time delivery and zero-error streaks',
          ],
        },
      ],
    },
  },
  {
    slug: 'media-buyer',
    title: 'Media Buyer',
    subtitle: 'Growth Architect',
    department: 'growth',
    departmentLabel: 'Growth',
    summary:
      'Turn capital into qualified conversations. Philosophy-driven campaigns across Meta, Google, and YouTube.',
    description:
      'Engine of lead flow. Turn capital into qualified conversations — predictably, profitably, at scale. Scientist and artist.',
    locations: ['remote', 'us-md'],
    tags: ['United States, MD', 'EST', 'Remote'],
    level: 3,
    seoDescription:
      'Join Divine Acquisition as a Media Buyer. Take capital and turn it into qualified conversations across Meta, Google, and YouTube. Remote position with base salary plus performance bonuses.',
    detail: {
      mission:
        "Philosophy Before Ad Spend. Every campaign rooted in strategic clarity before a dollar moves — we know the audience, the belief we're shifting, the action we're driving.",
      type: 'Full-time',
      compensation: 'Base + Performance',
      techStack: ['Meta Ads', 'Google Ads', 'YouTube', 'Analytics', 'Attribution'],
      apply: { kind: 'form' },
      sections: [
        {
          title: 'Responsibilities',
          items: [
            'Develop strategies aligned with offer economics and positioning',
            'Build campaign architectures: targeting, funnels, budgets, testing',
            'Launch and manage paid campaigns across Meta, Google, YouTube',
            'Implement tracking, attribution, and pixel configuration',
            'Monitor CPL, CPA, ROAS, CTR, hook rates daily',
            'Run structured A/B tests; scale winners aggressively',
          ],
        },
        {
          title: 'Requirements',
          items: [
            'Managed $10K+/mo in ad spend before',
            'Equally fluent in Ads Manager and spreadsheets',
            'Student of direct response — you know why things work',
            'Hate wasted spend more than you love big budgets',
          ],
        },
        {
          title: 'Who This Is For',
          items: ['Blend creative intuition with mathematical rigor', 'Report insights, not just data'],
        },
        {
          title: 'Who This Is NOT For',
          items: [
            'Only boosted posts or hobby-budget campaigns',
            'Rely on "the algorithm" without understanding why',
            'Think media buying is set-and-forget',
          ],
        },
        {
          title: 'What Success Looks Like',
          items: [
            'Consistent lead flow at target CPL',
            'Mature campaigns ≥ 2x ROAS, target 3–5x',
            '5–10 new creative variations tested per week',
            '95%+ of budgets deployed — no waste',
          ],
        },
        {
          title: 'Compensation',
          items: [
            'Base: $2,000–$4,000/mo by experience',
            'Performance bonus tied to CPL / CPA targets',
            'Potential profit share on managed campaigns',
          ],
        },
      ],
    },
  },
  {
    slug: 'setter',
    title: 'SDR / Setter',
    subtitle: 'Sales Development',
    department: 'sales',
    departmentLabel: 'Sales',
    summary:
      'Book the right calls with high-quality prospects. Identify fit, educate, qualify for our closers.',
    description:
      'First point of contact for businesses exploring our retention infrastructure. Identify fit, educate, qualify.',
    locations: ['remote', 'us-md'],
    tags: ['United States, MD', 'EST', 'Remote'],
    level: 1,
    seoDescription:
      'Join Divine Acquisition as an SDR / Setter. Book qualified calls with high-quality prospects and help grow our client base. Remote position with competitive compensation and upside.',
    detail: {
      mission:
        'Book the right calls with high-quality prospects. Less volume, more fit — belief shaping beats hard selling.',
      type: 'Full-time',
      compensation: 'Competitive + Upside',
      apply: { kind: 'airtable', src: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pag2MVTVHyntieliL/form' },
      sections: [
        {
          title: 'Responsibilities',
          items: [
            'Prospect service-based businesses that fit our ideal client profile',
            'Run discovery conversations focused on understanding, not pitching',
            'Educate prospects on retention infrastructure and likely outcomes',
            'Qualify on fit, not just interest — protect closer time',
            'Maintain disciplined CRM hygiene and pipeline documentation',
          ],
        },
        {
          title: 'Requirements',
          items: [
            '0–2 years in sales, BD, or client-facing roles',
            'Strong written and verbal communication',
            'Coachable — eager to take feedback and run with it',
            'Comfortable with cold outreach (email, LinkedIn, phone)',
          ],
        },
        {
          title: 'Who This Is For',
          items: [
            'Hungry self-starters building a real sales career',
            'Genuinely curious about businesses and their challenges',
            'Communicators who build rapport quickly',
          ],
        },
        {
          title: 'Who This Is NOT For',
          items: [
            'Looking for "get rich quick"',
            "Can't handle rejection or need constant validation",
            'Not coachable or already "know it all"',
          ],
        },
        {
          title: 'What Success Looks Like',
          items: [
            'Consistently booking qualified calls that convert',
            'Pipeline of genuinely interested, high-quality prospects',
            'Closers spend time on real buyers; cash-per-call rises',
          ],
        },
      ],
    },
  },
  {
    slug: 'closer',
    title: 'Closer',
    subtitle: 'Sales',
    department: 'sales',
    departmentLabel: 'Sales',
    summary:
      'Convert qualified opportunities into long-term partnerships. Show how our infrastructure transforms businesses.',
    description:
      'Convert qualified opportunities into long-term partnerships. Show prospects how our infrastructure transforms their business.',
    locations: ['remote', 'us-md'],
    tags: ['United States, MD', 'EST', 'Remote'],
    level: 3,
    seoDescription:
      'Join Divine Acquisition as a Closer. Convert qualified opportunities into long-term client partnerships through consultative sales. Remote position with base salary plus commission.',
    detail: {
      mission:
        'Close deals that are right for both parties. Sales is solving problems, not pushing products. Done well, clients renew, refer, and compound.',
      type: 'Full-time',
      compensation: 'Base + Commission',
      apply: { kind: 'form' },
      sections: [
        {
          title: 'Responsibilities',
          items: [
            'Run consultative sales calls with qualified prospects',
            'Present retention infrastructure and demonstrate ROI',
            'Navigate complex decisions and handle objections cleanly',
            'Negotiate and close deals that fit both sides',
            'Hand off smoothly to Client Success for onboarding',
          ],
        },
        {
          title: 'Requirements',
          items: [
            '3+ years B2B sales, ideally services or SaaS',
            'Track record of meeting or exceeding quota',
            'Consultative or solution-selling experience',
            'Articulate complex value propositions simply',
          ],
        },
        {
          title: 'Who This Is For',
          items: [
            'Strategic thinkers who connect problems to solutions',
            'Trust-builders who play the long game',
            'Believe the right deal matters more than any deal',
          ],
        },
        {
          title: 'Who This Is NOT For',
          items: [
            'High-pressure manipulators',
            'View sales as pure numbers, not fit',
            'Cut corners or overpromise to close',
          ],
        },
        {
          title: 'What Success Looks Like',
          items: [
            'Close deals only with clients who are the right fit',
            'Build a portfolio of long-term, successful relationships',
            'Become the trusted advisor clients refer others to',
          ],
        },
      ],
    },
  },
  {
    slug: 'client-success',
    title: 'Client Success Manager',
    subtitle: 'Retention',
    department: 'client-success',
    departmentLabel: 'Client Success',
    summary:
      'Guardian of transformation. Own the relationship, experience, and outcome from sign-off through renewal.',
    description:
      'Guardian of transformation. Own the relationship, the experience, and the outcome — from sign-off through renewal and beyond.',
    locations: ['remote', 'us-md'],
    tags: ['United States, MD', 'EST', 'Remote'],
    level: 3,
    seoDescription:
      'Join Divine Acquisition as a Client Success Manager. Own client relationships from onboarding through renewal and drive transformation. Remote position with per-client retainer plus bonuses.',
    detail: {
      mission:
        'Retention is a philosophy, not a department. The work after the sale matters more than the work before.',
      type: 'Full-time',
      compensation: 'Per-Client + Bonuses',
      apply: { kind: 'form' },
      sections: [
        {
          title: 'Responsibilities',
          items: [
            'Onboard within 48 hours of close — assets, goals, expectations set',
            'Complete 100% of onboarding checklists in 7 days, no exceptions',
            'Deliver weekly check-ins for every active client',
            'Maintain dashboards: KPIs, milestones, deliverables, health scores',
            'Flag at-risk clients proactively, before churn',
            'Open renewal conversations 30–60 days before contract end',
          ],
        },
        {
          title: 'Requirements',
          items: [
            'Genuinely care about people and their outcomes',
            'Obsessively organized — checklists are second nature',
            "Proactive — anticipate problems, don't wait for them",
            'Comfortable with hard truths delivered with empathy',
          ],
        },
        {
          title: 'Who This Is For',
          items: [
            'Hold many client relationships without dropping balls',
            'See client success as the mission, not a stepping stone',
          ],
        },
        {
          title: 'Who This Is NOT For',
          items: [
            'Reactive — wait for complaints to act',
            'Hate documentation; "I\'ll remember it" is your strategy',
            'Avoid hard conversations to be liked',
          ],
        },
        {
          title: 'What Success Looks Like',
          items: [
            '100% onboarding completion within 7 days',
            'Weekly check-ins delivered every week, every client',
            '90%+ clients in green health status at any time',
            'Churn below 10%, renewals above 70%',
          ],
        },
        {
          title: 'Compensation',
          items: [
            'Per-client retainer: $75–$125/mo per active client',
            'Bonuses for retention and referrals',
            'Scales to $1,500–$3,000+/mo as client load grows',
          ],
        },
      ],
    },
  },
];

export const roleHref = (role: Role) => role.href ?? `/hiring/${role.slug}`;

export const getRole = (slug: string) => roles.find((role) => role.slug === slug);

export const aboutContent = `Divine Acquisition builds Acquisition, Retention & AI Growth Infrastructure for service-based businesses. We turn offerings into operating systems that compound trust, revenue, and loyalty. Two verticals: online businesses and select local businesses.

Three pillars:
• Devotion — trust deep enough to become conviction
• Value — simplify complexity; make the right path the easy path
• Exclusivity — we work with businesses ready for transformation, not quick fixes

What we believe:
• Fit over force — we win only when the client wins
• Simplicity scales — complexity is the enemy of repeatability
• Process over personality, systems over hustle, legacy over hype

We're not an agency. We're a consultancy of builders, architects, and operators who take pride in things that last. If you want to be part of something that matters — keep reading.`;
