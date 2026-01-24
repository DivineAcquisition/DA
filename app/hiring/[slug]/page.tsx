'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

const aboutContent = `Divine Acquisition builds Acquisition, Retention & AI Growth Infrastructure for service-based businesses. We exist to build timeless business infrastructures that compound trust, revenue & retention, turning our clients' offerings into operating systems that print trust, revenue, and long-term loyalty. We work across two verticals: online businesses & occasionally local businesses.

Our philosophy rests on three pillars:
• Devotion — We build trust so deep it becomes conviction.
• Value — We simplify complexity. We make the right path the easy path.
• Exclusivity — We are not for everyone. We work with businesses ready for transformation, not quick fixes.

What we believe:
• Fit over force — we only win when the client wins
• Simplicity scales — complexity is the enemy of repeatability
• Process over personality — a great system outperforms charisma
• Systems over hustle — we build infrastructure, not burnout
• Legacy over hype — we play the long game

Why join us:
Divine Acquisition is not an agency. We're a consultancy of builders, architects, and operators who take pride in creating things that last. We don't chase trends. We don't glorify grinding. We build systems that compound — for our clients and for ourselves. If you want to be part of something that matters — not just something that sells — keep reading.`;

// Icons for different section types
const sectionIcons: Record<string, React.ReactNode> = {
  'Responsibilities': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  ),
  'Requirements': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  ),
  'What Success Looks Like': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  'Who This Is For': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'Who This Is NOT For': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  'Compensation': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'About Divine Acquisition': (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
};

// Item icons for responsibilities
const itemIcons = [
  <svg key="1" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
  <svg key="2" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  <svg key="3" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
  <svg key="4" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>,
  <svg key="5" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>,
  <svg key="6" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
  <svg key="7" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>,
];

const jobs: Record<string, {
  title: string;
  subtitle: string;
  department: string;
  location: string;
  type: string;
  compensation: string;
  mission: string;
  description: string;
  sections: Array<{
    title: string;
    type: 'list' | 'text';
    items?: string[];
    content?: string;
  }>;
  techStack?: string[];
  useAirtable: boolean;
  airtableEmbed?: string;
}> = {
  'system-integrator': {
    title: 'Systems Architect',
    subtitle: 'Infrastructure',
    department: 'Operations',
    location: 'Remote',
    type: 'Full-time',
    compensation: 'Project + Retainer',
    mission: 'We build systems that create repeatable excellence. Every automation exists to serve a human outcome. Every workflow exists to create clarity. Every integration exists to eliminate friction.',
    description: 'You are the builder of machines. You take strategy and turn it into infrastructure — the pipelines, automations, workflows, and integrations that make our solutions actually work.',
    techStack: ['GoHighLevel', 'Zapier', 'Make', 'Airtable', 'APIs', 'Webhooks', 'Framer'],
    useAirtable: true,
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pagPWbnh31lQsrT7C/form',
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
        items: [
          'Translate business requirements into technical specifications and system architectures',
          'Build and configure GHL sub-accounts: pipelines, workflows, automations, triggers, and reporting dashboards',
          'Create Zapier/Make integrations connecting GHL with external tools (Airtable, Stripe, calendars)',
          'Build landing pages, VSL pages, and booking pages — mobile-optimized and fast-loading',
          'Test every build before delivery — walk through every path, trigger, and edge case',
          'Create Loom walkthroughs and documentation for every build',
          'Monitor live systems, troubleshoot issues within 24 hours, and optimize based on performance data',
        ],
      },
      {
        title: 'Requirements',
        type: 'list',
        items: [
          'Deep technical expertise — GHL, Zapier, Make, APIs, webhooks are your playground',
          'Systems thinking — you see logic flows, not just features and buttons',
          'Quality obsession — "good enough" makes you uncomfortable',
          'Independent problem-solving — translate requirements into solutions without hand-holding',
          'Documentation discipline — you know future-you will thank you',
        ],
      },
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          '95%+ project delivery rate (on time, on spec)',
          'Zero critical errors per project — must pass testing checklist before delivery',
          '100% of builds documented with Loom walkthroughs',
          'Issues resolved within 24 hours of report',
          'Systems run so smoothly that no one notices them — until they\'re gone',
        ],
      },
      {
        title: 'Compensation',
        type: 'list',
        items: [
          'Project-based: $75-$400 per project depending on complexity',
          'Retainer option: $1,000-$2,500/month for ongoing maintenance and builds',
          'Bonuses for on-time delivery and zero-error streaks',
        ],
      },
    ],
  },
  'setter': {
    title: 'Appointment Setter',
    subtitle: 'Sales Development',
    department: 'Sales',
    location: 'Remote',
    type: 'Full-time',
    compensation: 'Competitive + Upside',
    mission: 'We\'re a revenue-focused growth company built on one principle: quality scales, volume lies. Our sales engine is designed to produce predictable cash, not calendar noise. Every role in Sales exists to protect efficiency, trust, and downstream outcomes.',
    description: 'Protect revenue at the front door. Convert inbound attention into qualified, high-intent sales conversations that reliably turn into cash. You are not here to book calls at any cost — you are here to create leverage by qualifying decisively.',
    useAirtable: true,
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pag2MVTVHyntieliL/form',
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
        items: [
          'Disqualify low-intent or bad-fit leads decisively and early',
          'Book only high-quality, qualified calls that convert to opportunities',
          'Conduct discovery conversations focused on understanding, not pitching',
          'Educate prospects on retention infrastructure and possible outcomes',
          'Maintain disciplined CRM hygiene and pipeline documentation',
          'Protect closer time by refusing to pass low-quality leads downstream',
        ],
      },
      {
        title: 'Requirements',
        type: 'list',
        items: [
          '0-2 years in sales, business development, or client-facing roles',
          'Strong written and verbal communication skills',
          'Coachable mindset — eager to learn and implement feedback',
          'Comfort with outbound prospecting (cold email, LinkedIn, phone)',
          'Understanding that belief shaping beats hard selling',
        ],
      },
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          'Consistently booking qualified calls that convert to opportunities',
          'Building a pipeline of high-quality prospects who are genuinely interested',
          'Mastering the discovery process and understanding client needs deeply',
          'Closers spend time only on real buyers and cash collected per call increases',
        ],
      },
      {
        title: 'Who This Is NOT For',
        type: 'list',
        items: [
          'People looking for a "get rich quick" opportunity',
          'Those who can\'t handle rejection or need constant validation',
          'Anyone who isn\'t coachable or thinks they already know everything',
          'People who make excuses instead of finding solutions',
        ],
      },
    ],
  },
  'closer': {
    title: 'Closer',
    subtitle: 'Sales',
    department: 'Sales',
    location: 'Remote',
    type: 'Full-time',
    compensation: 'Base + Commission',
    mission: 'We close deals that are right for both parties. Sales is about solving problems, not pushing products. When you do this job well, clients get results, they renew, they refer, and they become the foundation of a business that compounds.',
    description: 'Convert qualified opportunities into long-term client partnerships. Guide prospects through decision-making and help them understand how our retention infrastructure can transform their business.',
    useAirtable: false,
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
        items: [
          'Conduct consultative sales calls with qualified prospects',
          'Present retention infrastructure solutions and demonstrate value',
          'Navigate complex decision-making processes and handle objections',
          'Negotiate and close deals that are right for both parties',
          'Ensure smooth handoff to Client Success for onboarding',
        ],
      },
      {
        title: 'Requirements',
        type: 'list',
        items: [
          '3+ years of B2B sales experience, preferably in services or SaaS',
          'Proven track record of meeting or exceeding quota',
          'Experience with consultative or solution selling methodologies',
          'Strong presentation and negotiation skills',
          'Ability to articulate complex value propositions simply',
        ],
      },
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          'Closing deals with clients who are genuinely the right fit',
          'Building a portfolio of successful, long-term client relationships',
          'Maintaining high close rates on qualified opportunities',
          'Becoming a trusted advisor that clients refer others to',
        ],
      },
      {
        title: 'Who This Is NOT For',
        type: 'list',
        items: [
          'High-pressure salespeople who rely on manipulation tactics',
          'Those who view sales as a numbers game without caring about fit',
          'People who aren\'t willing to deeply understand client businesses',
          'Anyone who cuts corners or overpromises to close deals',
        ],
      },
    ],
  },
  'media-buyer': {
    title: 'Media Buyer',
    subtitle: 'Growth Architect',
    department: 'Growth',
    location: 'Remote',
    type: 'Full-time',
    compensation: 'Base + Performance',
    mission: 'We practice Philosophy Before Ad Spend: every campaign must be rooted in strategic clarity before a single dollar is spent. We know who we\'re talking to, what belief we\'re shifting, and what action we\'re driving.',
    description: 'You are the engine of lead flow. Take capital and turn it into qualified conversations — predictably, profitably, at scale. Be both scientist and artist.',
    techStack: ['Meta Ads', 'Google Ads', 'YouTube', 'Analytics', 'Attribution'],
    useAirtable: false,
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
        items: [
          'Develop media buying strategies aligned with offer economics and positioning',
          'Build campaign architectures: audience targeting, funnel structure, budget allocation, testing frameworks',
          'Launch and manage paid campaigns across Meta, Google, and YouTube',
          'Implement proper tracking, attribution, and pixel configuration',
          'Monitor performance daily — CPL, CPA, ROAS, CTR, hook rates',
          'Run structured A/B tests and scale winners aggressively',
          'Deliver weekly performance reports with insights, not just data',
        ],
      },
      {
        title: 'Requirements',
        type: 'list',
        items: [
          'Managed meaningful ad spend before ($10K+ per month minimum)',
          'Equally comfortable in Ads Manager and analyzing data in spreadsheets',
          'Understanding that media buying blends creative intuition and mathematical rigor',
          'Student of direct response marketing — you study what works and why',
          'Obsessed with efficiency — you hate wasted spend more than you love big budgets',
        ],
      },
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          'Consistent lead flow at target CPL ($20-50 for B2B)',
          'Positive ROAS on all mature campaigns (minimum 2x, target 3-5x)',
          'Testing velocity: minimum 5-10 new creative variations per week',
          '95%+ of budgets deployed — no underspend, no waste',
          'You treat ad spend like it\'s your own money',
        ],
      },
      {
        title: 'Compensation',
        type: 'list',
        items: [
          'Base salary: $2,000-$4,000/month depending on experience',
          'Performance bonus tied to CPL/CPA targets',
          'Potential profit share on campaigns you manage',
        ],
      },
    ],
  },
  'client-success': {
    title: 'Client Success Manager',
    subtitle: 'Retention',
    department: 'Client Success',
    location: 'Remote',
    type: 'Full-time',
    compensation: 'Per-Client + Bonuses',
    mission: 'Retention is not a department — it\'s a philosophy. We don\'t acquire clients to extract revenue. We acquire them to create transformation. The work after the sale is more important than the work before it.',
    description: 'You are the guardian of transformation. Your job begins the moment a client signs and continues until they renew — and beyond. You own the relationship, the experience, and the outcome.',
    useAirtable: false,
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
        items: [
          'Run onboarding calls within 48 hours of close — collect assets, clarify goals, set expectations',
          'Complete 100% of onboarding checklists within 7 days — no exceptions',
          'Deliver weekly check-ins for every active client (async Loom or sync call)',
          'Maintain client dashboards — track KPIs, milestones, deliverables, and health scores',
          'Proactively flag at-risk clients before they churn',
          'Begin renewal conversations 30-60 days before contract end',
          'Ask for referrals at peak satisfaction moments',
        ],
      },
      {
        title: 'Requirements',
        type: 'list',
        items: [
          'Genuinely care about people and their success — not just retention metrics',
          'Obsessively organized — checklists, follow-ups, documentation are second nature',
          'Proactive mindset — you anticipate problems, not wait for them',
          'Can hold multiple client relationships without dropping balls',
          'Comfortable with difficult conversations — hard truths delivered with empathy',
        ],
      },
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          '100% onboarding completion within 7 days',
          'Weekly check-ins delivered for every client, every week',
          '90%+ clients in "green" health status at any given time',
          'Churn rate below 10%',
          'Renewal rate of 70%+ on eligible contracts',
          '2+ referrals generated per quarter per 10 clients',
        ],
      },
      {
        title: 'Compensation',
        type: 'list',
        items: [
          'Per-client retainer: $75-$125 per active client per month',
          'Bonuses for retention metrics (churn below target, renewals above target)',
          'Bonuses for referrals generated',
          'Scales to $1,500-$3,000+/month as client load increases',
        ],
      },
    ],
  },
};

function ApplicationForm({ jobTitle }: { jobTitle: string }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    linkedin: '',
    portfolio: '',
    loomVideo: '',
    experience: '',
    whyYou: '',
    availability: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#5500FF]/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-semibold text-white mb-3">Application Submitted</h3>
        <p className="text-neutral-400 font-light">
          Thank you for applying for the {jobTitle} position. We&apos;ll review your application and get back to you within 5-7 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            Full Name *
          </label>
          <input
            type="text"
            required
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF]/50 focus:ring-1 focus:ring-[#5500FF]/50 transition-all"
            placeholder="John Doe"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            Email Address *
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF]/50 focus:ring-1 focus:ring-[#5500FF]/50 transition-all"
            placeholder="john@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF]/50 focus:ring-1 focus:ring-[#5500FF]/50 transition-all"
            placeholder="+1 (555) 000-0000"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            LinkedIn Profile
          </label>
          <input
            type="url"
            value={formData.linkedin}
            onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF]/50 focus:ring-1 focus:ring-[#5500FF]/50 transition-all"
            placeholder="https://linkedin.com/in/username"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
          Portfolio / Website
        </label>
        <input
          type="url"
          value={formData.portfolio}
          onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF]/50 focus:ring-1 focus:ring-[#5500FF]/50 transition-all"
          placeholder="https://yourportfolio.com"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Loom Video Introduction
          </span>
        </label>
        <input
          type="url"
          value={formData.loomVideo}
          onChange={(e) => setFormData({ ...formData, loomVideo: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF]/50 focus:ring-1 focus:ring-[#5500FF]/50 transition-all"
          placeholder="https://www.loom.com/share/your-video-id"
        />
        <p className="mt-2 text-xs text-neutral-500">Record a 2-3 minute video introducing yourself and why you&apos;re interested in this role.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
          Relevant Experience *
        </label>
        <textarea
          required
          rows={4}
          value={formData.experience}
          onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF]/50 focus:ring-1 focus:ring-[#5500FF]/50 transition-all resize-none"
          placeholder="Tell us about your relevant experience and accomplishments..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
          Why are you the right fit? *
        </label>
        <textarea
          required
          rows={4}
          value={formData.whyYou}
          onChange={(e) => setFormData({ ...formData, whyYou: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF]/50 focus:ring-1 focus:ring-[#5500FF]/50 transition-all resize-none"
          placeholder="What makes you uniquely qualified for this role?"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
          Availability *
        </label>
        <select
          required
          value={formData.availability}
          onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#5500FF]/50 focus:ring-1 focus:ring-[#5500FF]/50 transition-all"
        >
          <option value="" className="bg-[#0a0a0a]">Select availability</option>
          <option value="immediate" className="bg-[#0a0a0a]">Immediately</option>
          <option value="1-2weeks" className="bg-[#0a0a0a]">1-2 weeks</option>
          <option value="2-4weeks" className="bg-[#0a0a0a]">2-4 weeks</option>
          <option value="1month+" className="bg-[#0a0a0a]">1 month+</option>
        </select>
      </div>

      <button
        type="submit"
        className="w-full py-4 rounded-xl bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[#5500FF]/30"
      >
        Submit Application
      </button>

      <p className="text-xs text-neutral-500 text-center font-light">
        By submitting, you agree to our privacy policy and consent to being contacted about this opportunity.
      </p>
    </form>
  );
}

export default function JobPage() {
  const params = useParams();
  const slug = params.slug as string;
  const job = jobs[slug];

  if (!job) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-medium mb-4">Position not found</h1>
          <Link href="/hiring" className="text-[#907DFF] hover:text-white transition-colors">
            ← Back to all positions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white antialiased selection:bg-[#5500FF]/50 selection:text-purple-50 overflow-x-hidden">
      
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(144,125,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(144,125,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Background Glow Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] rounded-full opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.3) 0%, rgba(85,0,255,0.15) 40%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        <div 
          className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(85,0,255,0.4) 0%, rgba(144,125,255,0.15) 50%, transparent 70%)',
            filter: 'blur(120px)',
          }}
        />
        <div 
          className="absolute top-[50%] left-[-15%] w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.3) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-24 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/hiring" className="group">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={160} 
              height={160}
              className="group-hover:opacity-80 transition-opacity"
            />
          </Link>
          
          <Link
            href="/hiring"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            All Positions
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          
          {/* Hero Section */}
          <section className="mb-16">
            {/* Department Badge */}
            <div className="flex items-center gap-2 mb-6">
              <span className="w-6 h-px bg-[#5500FF]"></span>
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">
                {job.department}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white tracking-tight mb-6">
              {job.title}
            </h1>

            {/* Description */}
            <p className="text-xl text-neutral-400 font-light leading-relaxed mb-10 max-w-3xl">
              {job.description}
            </p>

            {/* Meta Info Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <div>
                <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1">Department</p>
                <p className="text-sm font-medium text-white">{job.department}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1">Location</p>
                <p className="text-sm font-medium text-white">{job.location}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1">Type</p>
                <p className="text-sm font-medium text-white">{job.type}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1">Compensation</p>
                <p className="text-sm font-medium text-[#907DFF]">{job.compensation}</p>
              </div>
            </div>
          </section>

          {/* Mission Section */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#5500FF]/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
              <h2 className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">The Mission</h2>
            </div>
            <p className="text-lg text-neutral-300 font-light leading-relaxed">
              {job.mission}
            </p>
          </section>

          {/* Tech Stack */}
          {job.techStack && (
            <section className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#5500FF]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </div>
                <h2 className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">Tech Stack</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {job.techStack.map((tech, index) => (
                  <span 
                    key={index}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-[#5500FF]/10 text-[#907DFF] border border-[#5500FF]/20"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Content Sections */}
          {job.sections.map((section, sectionIndex) => (
            <section key={sectionIndex} className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#5500FF]/20 flex items-center justify-center text-[#907DFF]">
                  {sectionIcons[section.title] || sectionIcons['Responsibilities']}
                </div>
                <h2 className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">{section.title}</h2>
              </div>
              
              {section.type === 'text' && section.content && (
                <p className="text-neutral-400 font-light leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              )}
              
              {section.type === 'list' && section.items && (
                <div className="space-y-4">
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-start gap-4 group">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-[#907DFF] group-hover:bg-[#5500FF]/10 group-hover:border-[#5500FF]/20 transition-all">
                        {itemIcons[itemIndex % itemIcons.length]}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-neutral-300 font-light leading-relaxed">{item}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* About Section */}
          <section className="mb-16 p-8 rounded-2xl bg-gradient-to-br from-[#5500FF]/5 to-transparent border border-[#5500FF]/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#5500FF]/20 flex items-center justify-center text-[#907DFF]">
                {sectionIcons['About Divine Acquisition']}
              </div>
              <h2 className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">About Divine Acquisition</h2>
            </div>
            <p className="text-neutral-400 font-light leading-relaxed whitespace-pre-line text-sm">
              {aboutContent}
            </p>
          </section>

          {/* Application Form Section */}
          <section id="apply">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5500FF] to-[#907DFF] flex items-center justify-center text-white shadow-lg shadow-[#5500FF]/30">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Apply for {job.title}</h2>
                <p className="text-sm text-neutral-500">Complete the form below to submit your application.</p>
              </div>
            </div>

            <div className="relative rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-[#5500FF]/5 blur-[80px] pointer-events-none" />
              
              <div className="relative">
                {job.useAirtable && job.airtableEmbed ? (
                  <iframe 
                    className="airtable-embed w-full border-0"
                    src={job.airtableEmbed}
                    width="100%"
                    height="2400"
                    style={{ 
                      background: 'transparent',
                    }}
                  />
                ) : (
                  <ApplicationForm jobTitle={job.title} />
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Link href="/hiring">
                <Image 
                  src="/6.png" 
                  alt="Divine Acquisition" 
                  width={32} 
                  height={32}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                />
              </Link>
              <span className="text-neutral-600 text-xs font-light">
                © 2026 Divine Acquisition
              </span>
            </div>
            <div className="flex items-center gap-5">
              <a href="https://instagram.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-500 hover:text-[#907DFF] transition-colors">
                Instagram
              </a>
              <a href="https://x.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-500 hover:text-[#907DFF] transition-colors">
                Twitter
              </a>
              <a href="https://divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-500 hover:text-[#907DFF] transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
