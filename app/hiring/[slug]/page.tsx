'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

const aboutContent = `Divine Acquisition builds Acquisition, Retention & AI Growth Infrastructure for service-based businesses. We turn offerings into operating systems that compound trust, revenue, and loyalty. Two verticals: online businesses and select local businesses.

Three pillars:
• Devotion — trust deep enough to become conviction
• Value — simplify complexity; make the right path the easy path
• Exclusivity — we work with businesses ready for transformation, not quick fixes

What we believe:
• Fit over force — we win only when the client wins
• Simplicity scales — complexity is the enemy of repeatability
• Process over personality, systems over hustle, legacy over hype

We're not an agency. We're a consultancy of builders, architects, and operators who take pride in things that last. If you want to be part of something that matters — keep reading.`;

// Glowing dot component
function GlowDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75 animate-ping" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5500FF] shadow-[0_0_10px_3px_rgba(85,0,255,0.6)]" />
    </span>
  );
}

// Icons only for Responsibilities and Requirements
const responsibilityIcons = [
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
    mission: 'Build systems that create repeatable excellence. Every automation serves a human outcome — clarity over complexity, every time.',
    description: 'Builder of machines. Take strategy and turn it into infrastructure — the pipelines, automations, and integrations that make everything work.',
    techStack: ['GoHighLevel', 'Zapier', 'Make', 'Airtable', 'APIs', 'Webhooks', 'Framer'],
    useAirtable: true,
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pagPWbnh31lQsrT7C/form',
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
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
        type: 'list',
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
        type: 'list',
        items: [
          '95%+ on-time, on-spec delivery',
          'Zero critical errors — testing checklist passed before delivery',
          '100% of builds documented with Loom walkthroughs',
          'Live issues resolved within 24 hours',
        ],
      },
      {
        title: 'Compensation',
        type: 'list',
        items: [
          'Project-based: $75–$400 per build, scaled by complexity',
          'Retainer option: $1,000–$2,500/mo for ongoing builds + maintenance',
          'Bonuses for on-time delivery and zero-error streaks',
        ],
      },
    ],
  },
  'setter': {
    title: 'SDR / Setter',
    subtitle: 'Sales Development',
    department: 'Sales',
    location: 'Remote',
    type: 'Full-time',
    compensation: 'Competitive + Upside',
    mission: 'Book the right calls with high-quality prospects. Less volume, more fit — belief shaping beats hard selling.',
    description: 'First point of contact for businesses exploring our retention infrastructure. Identify fit, educate, qualify.',
    useAirtable: true,
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pag2MVTVHyntieliL/form',
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
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
        type: 'list',
        items: [
          '0–2 years in sales, BD, or client-facing roles',
          'Strong written and verbal communication',
          'Coachable — eager to take feedback and run with it',
          'Comfortable with cold outreach (email, LinkedIn, phone)',
        ],
      },
      {
        title: 'Who This Is For',
        type: 'list',
        items: [
          'Hungry self-starters building a real sales career',
          'Genuinely curious about businesses and their challenges',
          'Communicators who build rapport quickly',
        ],
      },
      {
        title: 'Who This Is NOT For',
        type: 'list',
        items: [
          'Looking for "get rich quick"',
          'Can\'t handle rejection or need constant validation',
          'Not coachable or already "know it all"',
        ],
      },
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          'Consistently booking qualified calls that convert',
          'Pipeline of genuinely interested, high-quality prospects',
          'Closers spend time on real buyers; cash-per-call rises',
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
    mission: 'Close deals that are right for both parties. Sales is solving problems, not pushing products. Done well, clients renew, refer, and compound.',
    description: 'Convert qualified opportunities into long-term partnerships. Show prospects how our infrastructure transforms their business.',
    useAirtable: false,
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
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
        type: 'list',
        items: [
          '3+ years B2B sales, ideally services or SaaS',
          'Track record of meeting or exceeding quota',
          'Consultative or solution-selling experience',
          'Articulate complex value propositions simply',
        ],
      },
      {
        title: 'Who This Is For',
        type: 'list',
        items: [
          'Strategic thinkers who connect problems to solutions',
          'Trust-builders who play the long game',
          'Believe the right deal matters more than any deal',
        ],
      },
      {
        title: 'Who This Is NOT For',
        type: 'list',
        items: [
          'High-pressure manipulators',
          'View sales as pure numbers, not fit',
          'Cut corners or overpromise to close',
        ],
      },
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          'Close deals only with clients who are the right fit',
          'Build a portfolio of long-term, successful relationships',
          'Become the trusted advisor clients refer others to',
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
    mission: 'Philosophy Before Ad Spend. Every campaign rooted in strategic clarity before a dollar moves — we know the audience, the belief we\'re shifting, the action we\'re driving.',
    description: 'Engine of lead flow. Turn capital into qualified conversations — predictably, profitably, at scale. Scientist and artist.',
    techStack: ['Meta Ads', 'Google Ads', 'YouTube', 'Analytics', 'Attribution'],
    useAirtable: false,
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
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
        type: 'list',
        items: [
          'Managed $10K+/mo in ad spend before',
          'Equally fluent in Ads Manager and spreadsheets',
          'Student of direct response — you know why things work',
          'Hate wasted spend more than you love big budgets',
        ],
      },
      {
        title: 'Who This Is For',
        type: 'list',
        items: [
          'Blend creative intuition with mathematical rigor',
          'Report insights, not just data',
        ],
      },
      {
        title: 'Who This Is NOT For',
        type: 'list',
        items: [
          'Only boosted posts or hobby-budget campaigns',
          'Rely on "the algorithm" without understanding why',
          'Think media buying is set-and-forget',
        ],
      },
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          'Consistent lead flow at target CPL',
          'Mature campaigns ≥ 2x ROAS, target 3–5x',
          '5–10 new creative variations tested per week',
          '95%+ of budgets deployed — no waste',
        ],
      },
      {
        title: 'Compensation',
        type: 'list',
        items: [
          'Base: $2,000–$4,000/mo by experience',
          'Performance bonus tied to CPL / CPA targets',
          'Potential profit share on managed campaigns',
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
    mission: 'Retention is a philosophy, not a department. The work after the sale matters more than the work before.',
    description: 'Guardian of transformation. Own the relationship, the experience, and the outcome — from sign-off through renewal and beyond.',
    useAirtable: false,
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
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
        type: 'list',
        items: [
          'Genuinely care about people and their outcomes',
          'Obsessively organized — checklists are second nature',
          'Proactive — anticipate problems, don\'t wait for them',
          'Comfortable with hard truths delivered with empathy',
        ],
      },
      {
        title: 'Who This Is For',
        type: 'list',
        items: [
          'Hold many client relationships without dropping balls',
          'See client success as the mission, not a stepping stone',
        ],
      },
      {
        title: 'Who This Is NOT For',
        type: 'list',
        items: [
          'Reactive — wait for complaints to act',
          'Hate documentation; "I\'ll remember it" is your strategy',
          'Avoid hard conversations to be liked',
        ],
      },
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          '100% onboarding completion within 7 days',
          'Weekly check-ins delivered every week, every client',
          '90%+ clients in green health status at any time',
          'Churn below 10%, renewals above 70%',
        ],
      },
      {
        title: 'Compensation',
        type: 'list',
        items: [
          'Per-client retainer: $75–$125/mo per active client',
          'Bonuses for retention and referrals',
          'Scales to $1,500–$3,000+/mo as client load grows',
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
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#5500FF]/20 flex items-center justify-center shadow-[0_0_30px_10px_rgba(85,0,255,0.3)]">
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
    <form onSubmit={handleSubmit} className="p-5 sm:p-6 md:p-8 space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        <div>
          <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            Full Name *
          </label>
          <input
            type="text"
            required
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
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
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
            placeholder="john@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        <div>
          <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
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
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
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
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
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
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
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
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all resize-none"
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
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all resize-none"
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
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
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
        className="w-full py-4 rounded-xl bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white font-semibold hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(85,0,255,0.5)]"
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

  // Check if section should use icons (only Responsibilities and Requirements)
  const shouldUseIcons = (title: string) => {
    return title === 'Responsibilities' || title === 'Requirements';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white antialiased selection:bg-[#5500FF]/50 selection:text-purple-50 overflow-x-hidden">
      
      {/* Grid Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(144,125,255,0.8) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(144,125,255,0.8) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Background Glow Effects - Deep #6200FF */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Main top glow - deep purple #6200FF */}
        <div 
          className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-full md:w-[1400px] h-[700px] md:h-[900px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(98,0,255,0.5) 0%, rgba(98,0,255,0.25) 30%, rgba(144,125,255,0.1) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Bottom right glow - #907DFF accent */}
        <div 
          className="absolute bottom-[-10%] right-0 w-full md:w-[700px] h-[500px] md:h-[600px]"
          style={{
            background: 'radial-gradient(ellipse at bottom right, rgba(144,125,255,0.5) 0%, rgba(98,0,255,0.2) 40%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Left side glow */}
        <div 
          className="absolute top-1/2 left-0 -translate-y-1/2 w-[300px] md:w-[500px] h-[500px] md:h-[600px]"
          style={{
            background: 'radial-gradient(ellipse at left center, rgba(144,125,255,0.4) 0%, transparent 50%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Center accent glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]"
          style={{
            background: 'radial-gradient(circle, rgba(98,0,255,0.15) 0%, transparent 50%)',
            filter: 'blur(100px)',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 sm:h-20 md:h-28 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link href="/hiring" className="group flex items-center">
            <Image
              src="/logo.png"
              alt="Divine Acquisition"
              width={200}
              height={200}
              priority
              className="h-9 sm:h-12 md:h-16 w-auto group-hover:opacity-80 transition-opacity"
            />
          </Link>

          <Link
            href="/hiring"
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold bg-gradient-to-r from-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_25px_rgba(98,0,255,0.4)] whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">All Positions</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-24 sm:pt-32 md:pt-36 pb-16 sm:pb-20 px-5 sm:px-6">
        <div className="max-w-4xl mx-auto">

          {/* Hero Section */}
          <section className="mb-12 sm:mb-16">
            {/* Department Badge */}
            <div className="flex items-center gap-3 mb-5 sm:mb-6">
              <span className="w-8 h-px bg-gradient-to-r from-[#5500FF] to-transparent shadow-[0_0_10px_rgba(85,0,255,0.8)]"></span>
              <span className="text-[11px] sm:text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
                {job.department}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-5 sm:mb-6 leading-[1.05]">
              {job.title}
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg md:text-xl text-neutral-400 font-light leading-relaxed mb-8 sm:mb-10 max-w-3xl">
              {job.description}
            </p>

            {/* Meta Info Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 p-5 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm">
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
                <p className="text-sm font-medium text-[#907DFF] drop-shadow-[0_0_8px_rgba(144,125,255,0.5)]">{job.compensation}</p>
              </div>
            </div>
          </section>

          {/* Mission Section */}
          <section className="mb-12 sm:mb-16">
            <div className="flex items-center gap-3 mb-5 sm:mb-6">
              <GlowDot />
              <h2 className="text-[11px] sm:text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">The Mission</h2>
            </div>
            <p className="text-base sm:text-lg text-neutral-300 font-light leading-relaxed">
              {job.mission}
            </p>
          </section>

          {/* Tech Stack */}
          {job.techStack && (
            <section className="mb-12 sm:mb-16">
              <div className="flex items-center gap-3 mb-5 sm:mb-6">
                <GlowDot />
                <h2 className="text-[11px] sm:text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">Tech Stack</h2>
              </div>
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {job.techStack.map((tech, index) => (
                  <span
                    key={index}
                    className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium bg-[#5500FF]/15 text-[#907DFF] border border-[#5500FF]/30 shadow-[0_0_15px_rgba(85,0,255,0.2)]"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Content Sections */}
          {job.sections.map((section, sectionIndex) => (
            <section key={sectionIndex} className="mb-12 sm:mb-16">
              <div className="flex items-center gap-3 mb-5 sm:mb-6">
                {shouldUseIcons(section.title) ? (
                  <div className="w-8 h-8 rounded-lg bg-[#5500FF]/20 flex items-center justify-center text-[#907DFF] shadow-[0_0_20px_rgba(85,0,255,0.4)]">
                    {section.title === 'Responsibilities' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                      </svg>
                    )}
                  </div>
                ) : (
                  <GlowDot />
                )}
                <h2 className="text-[11px] sm:text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">{section.title}</h2>
              </div>

              {section.type === 'text' && section.content && (
                <p className="text-sm sm:text-base text-neutral-400 font-light leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              )}

              {section.type === 'list' && section.items && (
                <div className="space-y-3.5 sm:space-y-4">
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-start gap-3.5 sm:gap-4 group">
                      {shouldUseIcons(section.title) ? (
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-[#907DFF] group-hover:bg-[#5500FF]/10 group-hover:border-[#5500FF]/20 group-hover:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all">
                          {responsibilityIcons[itemIndex % responsibilityIcons.length]}
                        </div>
                      ) : (
                        <div className="flex-shrink-0 mt-2">
                          <span className="block w-1.5 h-1.5 rounded-full bg-[#5500FF] shadow-[0_0_8px_3px_rgba(85,0,255,0.5)]" />
                        </div>
                      )}
                      <div className="flex-1 pt-1 min-w-0">
                        <p className="text-sm sm:text-base text-neutral-300 font-light leading-relaxed">{item}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* About Section */}
          <section className="mb-12 sm:mb-16 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#5500FF]/10 to-transparent border border-[#5500FF]/20 shadow-[0_0_40px_rgba(85,0,255,0.15)]">
            <div className="flex items-center gap-3 mb-5 sm:mb-6">
              <GlowDot />
              <h2 className="text-[11px] sm:text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">About Divine Acquisition</h2>
            </div>
            <p className="text-sm text-neutral-400 font-light leading-relaxed whitespace-pre-line">
              {aboutContent}
            </p>
          </section>

          {/* Application Form Section */}
          <section id="apply">
            <div className="relative rounded-2xl bg-[#111111] border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(85,0,255,0.1)]">
              {/* Background glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[200px] bg-gradient-to-b from-[#5500FF]/10 to-transparent pointer-events-none" />
              
              {/* Mac-style title bar */}
              <div className="relative flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-[#0d0d0d]">
                {/* Traffic light dots */}
                <div className="hidden sm:flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-[0_0_8px_rgba(255,95,86,0.5)]" />
                  <span className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-[0_0_8px_rgba(255,189,46,0.5)]" />
                  <span className="w-3 h-3 rounded-full bg-[#27C93F] shadow-[0_0_8px_rgba(39,201,63,0.5)]" />
                </div>

                {/* Step indicator and title */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-[#5500FF] to-[#907DFF] flex items-center justify-center text-white text-sm font-bold shadow-[0_0_20px_rgba(85,0,255,0.4)]">
                    2
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold text-white truncate">Apply for {job.title}</h2>
                    <p className="text-[11px] sm:text-xs text-neutral-500">Complete the form below to submit your application</p>
                  </div>
                </div>
              </div>
              
              {/* Form content */}
              <div className="relative">
                {job.useAirtable && job.airtableEmbed ? (
                  <iframe 
                    className="airtable-embed w-full border-0"
                    src={job.airtableEmbed}
                    width="100%"
                    height="5000"
                    style={{ 
                      background: 'transparent',
                      minHeight: '5000px',
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
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-5 md:gap-4">
            <div className="flex items-center gap-3">
              <Link href="/hiring">
                <Image
                  src="/6 (0-00-00-00)_1.png"
                  alt="Divine Acquisition"
                  width={32}
                  height={32}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                />
              </Link>
              <span className="text-neutral-500 text-xs font-medium">
                2025 © DivineAcquisition™, All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-5">
              <a href="https://instagram.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-[11px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Instagram
              </a>
              <a href="https://x.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-[11px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Twitter
              </a>
              <a href="https://divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[11px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
