'use client';

import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

const jobs: Record<string, {
  title: string;
  subtitle: string;
  location: string;
  type: string;
  description: string;
  sections: Array<{
    title: string;
    type: 'list' | 'text';
    items?: string[];
    content?: string;
  }>;
  techStack?: string[];
  airtableEmbed: string;
  airtableHeight: string;
}> = {
  'system-integrator': {
    title: 'Systems Architect',
    subtitle: 'Infrastructure',
    location: 'Remote',
    type: 'Full Time',
    description: 'You are the builder of machines. You take strategy and turn it into infrastructure — the pipelines, automations, workflows, and integrations that make our solutions actually work. You understand that every automation exists to serve a human outcome. Every workflow exists to create clarity. Every integration exists to eliminate friction.',
    techStack: ['GoHighLevel', 'Zapier', 'Make', 'Airtable', 'APIs', 'Webhooks', 'Framer'],
    sections: [
      {
        title: 'About Divine Acquisition',
        type: 'text',
        content: 'We are a B2B growth infrastructure consultancy that builds systematic acquisition, conversion, and retention engines for service-based businesses — primarily info product businesses (coaches, consultants, course creators) with occasional local market engagements.\n\nWe are not a marketing agency. We build the infrastructure that turns one-time transactions into long-term retained clients — systems that compound, processes that scale, and operations that outlive the hustle.',
      },
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
        title: 'Who This Is For',
        type: 'list',
        items: [
          'You\'re deeply technical — GHL, Zapier, Make, APIs, webhooks are your playground',
          'You think in systems and logic flows, not just features and buttons',
          'You\'re obsessive about quality — "good enough" makes you uncomfortable',
          'You can translate business requirements into technical solutions independently',
          'You document everything because you know future-you will thank you',
        ],
      },
      {
        title: 'Who This Is NOT For',
        type: 'list',
        items: [
          'If you\'re a "move fast and break things" person who hates testing',
          'If you can only follow instructions and can\'t architect solutions independently',
          'If you hate documentation and think "the build speaks for itself"',
          'If you can\'t communicate technical things to non-technical people',
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
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pagPWbnh31lQsrT7C/form',
    airtableHeight: '3500',
  },
  'setter': {
    title: 'Setter',
    subtitle: 'Sales Development',
    location: 'Remote',
    type: 'Full Time',
    description: 'Your primary goal is to book the right calls with high-quality prospects. You\'re the first point of contact for businesses exploring whether our retention infrastructure is right for them. This isn\'t about volume and pressure — it\'s about identifying fit, educating prospects, and qualifying opportunities for our closers.',
    sections: [
      {
        title: 'About Divine Acquisition',
        type: 'text',
        content: 'We are a B2B growth infrastructure consultancy that builds systematic acquisition, conversion, and retention engines for service-based businesses — primarily info product businesses (coaches, consultants, course creators) with occasional local market engagements.\n\nWe don\'t sell leads or traffic. We build infrastructure that turns one-time transactions into long-term retained clients.',
      },
      {
        title: 'Who This Is For',
        type: 'list',
        items: [
          'Hungry individuals who want to build a real sales career',
          'People who understand that belief shaping beats hard selling',
          'Self-starters who take ownership of their results',
          'Those genuinely curious about businesses and their challenges',
          'Individuals who communicate clearly and build rapport quickly',
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
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          'Consistently booking qualified calls that convert to opportunities',
          'Building a pipeline of high-quality prospects who are genuinely interested',
          'Mastering the discovery process and understanding client needs deeply',
          'Developing relationships that lead to long-term partnerships',
        ],
      },
      {
        title: 'Responsibilities',
        type: 'list',
        items: [
          'Prospect and identify service-based businesses that fit our ideal client profile',
          'Conduct discovery conversations focused on understanding, not pitching',
          'Educate prospects on retention infrastructure and possible outcomes',
          'Qualify opportunities based on fit, not just interest',
          'Maintain disciplined CRM hygiene and pipeline documentation',
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
        ],
      },
    ],
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pag2MVTVHyntieliL/form',
    airtableHeight: '3500',
  },
  'closer': {
    title: 'Closer',
    subtitle: 'Sales',
    location: 'Remote',
    type: 'Full Time',
    description: 'You convert qualified opportunities into long-term client partnerships. You understand that sales is about solving problems, not pushing products. You guide prospects through decision-making and help them understand how our retention infrastructure can transform their business.',
    sections: [
      {
        title: 'About Divine Acquisition',
        type: 'text',
        content: 'We are a B2B growth infrastructure consultancy that builds systematic acquisition, conversion, and retention engines for service-based businesses — primarily info product businesses (coaches, consultants, course creators) with occasional local market engagements.\n\nWe build infrastructure that turns one-time transactions into long-term retained clients — systems that compound and processes that scale.',
      },
      {
        title: 'Who This Is For',
        type: 'list',
        items: [
          'Experienced sales professionals who genuinely care about client outcomes',
          'Strategic thinkers who connect business problems to solutions',
          'Those who excel at building trust and long-term relationships',
          'People who understand that the right deal matters more than any deal',
          'Individuals who articulate complex value propositions simply',
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
        ],
      },
    ],
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pag2MVTVHyntieliL/form',
    airtableHeight: '3500',
  },
  'media-buyer': {
    title: 'Media Buyer',
    subtitle: 'Growth Architect',
    location: 'Remote',
    type: 'Full Time',
    description: 'You are the engine of lead flow. You take capital and turn it into qualified conversations — predictably, profitably, at scale. We practice Philosophy Before Ad Spend: every campaign must be rooted in strategic clarity before a single dollar is spent.',
    techStack: ['Meta Ads', 'Google Ads', 'YouTube', 'Analytics', 'Attribution'],
    sections: [
      {
        title: 'About Divine Acquisition',
        type: 'text',
        content: 'We are a B2B growth infrastructure consultancy that builds systematic acquisition, conversion, and retention engines for service-based businesses — primarily info product businesses (coaches, consultants, course creators) with occasional local market engagements.\n\nWe don\'t spray and pray. We don\'t worship the algorithm. We don\'t chase vanity metrics. We build campaigns rooted in strategic clarity.',
      },
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
        title: 'Who This Is For',
        type: 'list',
        items: [
          'You\'ve managed meaningful ad spend before ($10K+ per month minimum)',
          'You\'re equally comfortable in Ads Manager and analyzing data in spreadsheets',
          'You understand media buying blends creative intuition and mathematical rigor',
          'You\'re a student of direct response marketing',
          'You\'re obsessed with efficiency — you hate wasted spend',
        ],
      },
      {
        title: 'Who This Is NOT For',
        type: 'list',
        items: [
          'If you\'ve only boosted posts or run small hobby campaigns',
          'If you rely on "the algorithm" and can\'t explain why campaigns work',
          'If you\'re a pure creative who hates numbers, or pure analyst who hates creative',
          'If you think media buying is "set it and forget it"',
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
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pagpc2PC375pTxiDS/form',
    airtableHeight: '3500',
  },
  'client-success': {
    title: 'Client Success Manager',
    subtitle: 'Retention',
    location: 'Remote',
    type: 'Full Time',
    description: 'You are the guardian of transformation. Your job begins the moment a client signs and continues until they renew — and beyond. You own the relationship. You own the experience. You own the outcome. At Divine Acquisition, retention is not a department — it\'s a philosophy.',
    sections: [
      {
        title: 'About Divine Acquisition',
        type: 'text',
        content: 'We are a B2B growth infrastructure consultancy that builds systematic acquisition, conversion, and retention engines for service-based businesses — primarily info product businesses (coaches, consultants, course creators) with occasional local market engagements.\n\nWe don\'t acquire clients to extract revenue. We acquire them to create transformation. Your job is to ensure that transformation actually happens.',
      },
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
        title: 'Who This Is For',
        type: 'list',
        items: [
          'You genuinely care about people and their success',
          'You\'re obsessively organized — checklists, follow-ups, documentation',
          'You\'re proactive — you anticipate problems, not wait for them',
          'You can hold multiple client relationships without dropping balls',
          'You\'re comfortable with difficult conversations — hard truths with empathy',
        ],
      },
      {
        title: 'Who This Is NOT For',
        type: 'list',
        items: [
          'If you\'re reactive — waiting for clients to complain before you act',
          'If you hate documentation and think "I\'ll remember it" is a strategy',
          'If you struggle to hold people accountable because you want to be liked',
          'If you see client success as a stepping stone to "real" work',
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
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pag7FzW7LYVFxnAuT/form',
    airtableHeight: '3500',
  },
};

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
      
      {/* Background Glow Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] rounded-full opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.4) 0%, rgba(85,0,255,0.2) 40%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        <div 
          className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(85,0,255,0.5) 0%, rgba(144,125,255,0.2) 50%, transparent 70%)',
            filter: 'blur(120px)',
          }}
        />
        <div 
          className="absolute top-[30%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.3) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Floating Particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#907DFF]"
            style={{
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.3 + Math.random() * 0.4,
              animation: `floatParticle ${10 + Math.random() * 20}s linear infinite`,
              animationDelay: `${Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-28 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/hiring" className="group">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={120} 
              height={120}
              className="group-hover:opacity-80 transition-opacity"
            />
          </Link>
          
          <Link
            href="/hiring"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            All Positions
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-40 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          
          {/* Step 1: Role Description */}
          <section className="mb-20">
            <div className="flex items-center gap-4 mb-10">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#5500FF] to-[#907DFF] text-white text-sm font-bold shadow-lg shadow-[#5500FF]/30">
                1
              </div>
              <div>
                <span className="text-xs font-medium text-[#907DFF] uppercase tracking-widest">Step One</span>
                <h2 className="text-lg font-medium text-white">Review Position Details</h2>
              </div>
            </div>

            {/* Role Card */}
            <div className="relative p-8 md:p-10 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-sm overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#5500FF]/10 blur-[100px] pointer-events-none" />
              
              <div className="relative">
                {/* Tags */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <span className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#5500FF] text-white shadow-lg shadow-[#5500FF]/30">
                    {job.subtitle}
                  </span>
                  <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-white/5 text-neutral-300 border border-white/10">
                    {job.location}
                  </span>
                  <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-white/5 text-neutral-300 border border-white/10">
                    {job.type}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white tracking-tight mb-6">
                  {job.title}
                </h1>

                {/* Description */}
                <p className="text-lg text-neutral-400 font-light leading-relaxed mb-10">
                  {job.description}
                </p>

                {/* Tech Stack */}
                {job.techStack && (
                  <div className="mb-10">
                    <h3 className="text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-4">Tech Stack</h3>
                    <div className="flex flex-wrap gap-3">
                      {job.techStack.map((tech, index) => (
                        <span 
                          key={index}
                          className="px-4 py-2 rounded-xl text-sm font-medium bg-[#5500FF]/10 text-[#907DFF] border border-[#5500FF]/30"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sections */}
                <div className="space-y-10">
                  {job.sections.map((section, index) => (
                    <div key={index}>
                      <h3 className="text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#5500FF] shadow-lg shadow-[#5500FF]/50" />
                        {section.title}
                      </h3>
                      {section.type === 'text' && section.content && (
                        <p className="text-neutral-400 font-light leading-relaxed whitespace-pre-line">
                          {section.content}
                        </p>
                      )}
                      {section.type === 'list' && section.items && (
                        <ul className="space-y-3">
                          {section.items.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex items-start gap-4 text-neutral-300 font-light">
                              <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs text-[#907DFF] font-medium mt-0.5">
                                {itemIndex + 1}
                              </span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                {/* Divine Standard */}
                <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-[#5500FF]/10 to-transparent border border-[#5500FF]/20">
                  <h3 className="text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-4">The Divine Acquisition Standard</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-neutral-400 font-light">
                    <div className="flex items-start gap-2">
                      <span className="text-[#5500FF]">◆</span>
                      <span><strong className="text-white">Ownership Over Excuses</strong> — We fix it, not blame it</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#5500FF]">◆</span>
                      <span><strong className="text-white">Systems Over Hustle</strong> — Repeatable excellence</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#5500FF]">◆</span>
                      <span><strong className="text-white">Truth Over Comfort</strong> — Growth requires honesty</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#5500FF]">◆</span>
                      <span><strong className="text-white">Legacy Over Hype</strong> — We build things that last</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Step 2: Application Form */}
          <section id="apply">
            <div className="flex items-center gap-4 mb-10">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#5500FF] to-[#907DFF] text-white text-sm font-bold shadow-lg shadow-[#5500FF]/30">
                2
              </div>
              <div>
                <span className="text-xs font-medium text-[#907DFF] uppercase tracking-widest">Step Two</span>
                <h2 className="text-lg font-medium text-white">Submit Your Application</h2>
              </div>
            </div>

            <div className="relative rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-sm overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#5500FF]/10 blur-[100px] pointer-events-none" />
              
              <div className="relative p-6 border-b border-white/5">
                <h3 className="text-xl font-semibold text-white mb-1">Apply for {job.title}</h3>
                <p className="text-sm text-neutral-500 font-light">Complete the form below to submit your application.</p>
              </div>
              <div className="relative">
                <iframe 
                  className="airtable-embed w-full"
                  src={job.airtableEmbed}
                  frameBorder="0"
                  width="100%"
                  height={job.airtableHeight}
                  style={{ 
                    background: 'transparent',
                    minHeight: `${job.airtableHeight}px`
                  }}
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <Link href="/hiring">
                <Image 
                  src="/logo.png" 
                  alt="Divine Acquisition" 
                  width={64} 
                  height={64}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                />
              </Link>
              <span className="text-neutral-600 text-sm font-light">
                © 2026 Divine Acquisition
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://instagram.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors">
                Instagram
              </a>
              <a href="https://x.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors">
                Twitter
              </a>
              <a href="https://divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Styles */}
      <style jsx global>{`
        @keyframes floatParticle {
          0% {
            transform: translateY(100vh) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.5;
          }
          90% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-100vh) translateX(50px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
