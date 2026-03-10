'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const faqs = [
  {
    q: "What types of businesses do you work with?",
    a: "We work with two verticals: service-based online businesses (coaches, consultants, course creators, agencies) doing $15K-$50K/month, and local home service companies (residential cleaning, HVAC, plumbing) doing $10K+/month. The common thread is founders who've outgrown duct-tape operations and need real infrastructure to scale."
  },
  {
    q: "What does 'fractional Growth Operations' actually mean?",
    a: "It means you get a dedicated growth and operations partner embedded in your business — without the $120K+ salary of a full-time hire. We assess your current systems, build the infrastructure you're missing, and manage ongoing optimization. Think of it as having a COO-level operator on retainer who actually builds the systems, not just advises on them."
  },
  {
    q: "How is this different from hiring a marketing agency?",
    a: "Agencies sell you campaigns. We build infrastructure. An agency will run your ads and hand you a report. We'll audit your entire operation — lead capture, speed-to-lead, follow-up sequences, booking flow, retention systems, data architecture — and build the machine that turns every dollar you spend into compounding revenue. The systems we build are yours. They keep working whether we're involved or not."
  },
  {
    q: "What does the first 14 days look like?",
    a: "Week 1: Deep operational audit. We map your entire customer journey, identify every revenue leak, and quantify what each gap is costing you. Week 2: You receive a complete Growth Infrastructure Blueprint with prioritized fixes, projected ROI, and an implementation roadmap. If you move forward, we start building immediately."
  },
  {
    q: "What tools and platforms do you work with?",
    a: "We're platform-agnostic but deeply experienced with GoHighLevel, Supabase, Retell AI, Telnyx, BookingKoala, Housecall Pro, Zapier, Google Sheets, and custom-built solutions using Next.js. We work with whatever your business runs on — and when your current tools are the bottleneck, we'll tell you."
  },
  {
    q: "What if I'm not sure my business is ready for this?",
    a: "If you're doing $10K+/month and feeling the pain of manual processes, missed leads, or inconsistent revenue — you're ready. The consultation is free. We'll tell you honestly whether you need us or not. If you're pre-revenue or under $5K/month, we'll point you in the right direction, but our infrastructure is built for businesses with existing revenue to optimize."
  }
];

const testimonials = [
  {
    name: "BadgerLuxClean",
    role: "Residential Cleaning Company",
    quote: "The data infrastructure they built completely changed how we see our business. We went from guessing to knowing exactly where every dollar is going and where we're leaving money on the table.",
    result: "Complete Data Command Center + 7 automated workflows"
  },
  {
    name: "AlphaLuxClean",
    role: "Multi-State Cleaning Operation",
    quote: "They didn't just set up ads — they built the entire backend system. Booking flow, follow-up sequences, retention workflows. Everything talks to everything now.",
    result: "Full operational infrastructure across CA, TX & NY"
  },
  {
    name: "Bay Area Cleaning Pros",
    role: "Residential Cleaning Company",
    quote: "Having someone who actually understands both the operations side and the growth side is rare. They see the whole picture and build accordingly.",
    result: "Integrated growth + retention system"
  }
];

const pillars = [
  {
    num: "01",
    title: "Operational Audit",
    desc: "We map your entire customer journey from first touch to lifetime value. Every lead source, response time, follow-up sequence, booking flow, and retention touchpoint — quantified and measured. You'll see exactly where revenue is leaking and how much each gap costs you.",
    highlight: "ASSESS",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "AI-Powered Systems",
    desc: "Speed-to-lead AI that responds in under 60 seconds. Automated follow-up sequences that never forget a lead. Smart booking flows that reduce friction. Voice agents that handle overflow calls. Every system built to run without you touching it.",
    highlight: "IMPLEMENT",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Data Architecture",
    desc: "Custom command centers that track every metric that matters — CPL, booking rate, show rate, close rate, LTV, churn. Automated reporting via Zapier and Google Sheets. Real dashboards, not vanity metrics. You'll know your numbers cold.",
    highlight: "IMPLEMENT",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Retention Engine",
    desc: "Post-service follow-up sequences that convert one-time customers into recurring accounts. Membership conversion workflows. Reactivation campaigns for dormant clients. Referral systems that compound. This is where the real money is.",
    highlight: "RETAIN",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
      </svg>
    ),
  }
];

const processSteps = [
  {
    phase: "Phase 1",
    day: "Day 1",
    title: "Discovery & Onboarding",
    items: "30-minute strategy call. We map your current systems, revenue model, and growth goals. You fill out our operational intake form. We get access to your tools.",
  },
  {
    phase: "Phase 2",
    day: "Day 2-5",
    title: "Deep Operational Audit",
    items: "Complete customer journey mapping. Revenue leak identification and quantification. System-by-system analysis. Competitive benchmark. You receive your Growth Infrastructure Blueprint.",
  },
  {
    phase: "Phase 3",
    day: "Day 6-12",
    title: "Infrastructure Build",
    items: "AI speed-to-lead systems deployed. Automation workflows built and tested. Data architecture constructed. Retention sequences launched. Everything integrated and connected.",
  },
  {
    phase: "Phase 4",
    day: "Day 13-14",
    title: "Launch & Optimize",
    items: "Full quality assurance testing. Team training and handoff documentation. Analytics and tracking verified. Ongoing optimization begins. 24/7 Slack support activated.",
  }
];

const comparisonFeatures = [
  "14-day delivery guaranteed",
  "Full operational audit included",
  "AI-powered automation systems",
  "Custom data architecture",
  "Retention & reactivation systems",
  "Ongoing fractional operations",
  "24/7 Slack communication",
  "Platform-agnostic builds",
  "You own everything we build",
  "Results-obsessed — not deliverable-obsessed",
];

function GridBackground() {
  return (
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
  );
}

function HeroVisual() {
  return (
    <div className="relative w-full max-w-2xl mx-auto mt-16 mb-8">
      <div className="relative rounded-2xl border border-white/10 bg-[#111]/80 backdrop-blur-xl p-6 shadow-2xl shadow-purple-500/5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-3 text-xs text-neutral-500 font-mono">growth-dashboard.app</span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Leads Today', value: '47', change: '+12%', up: true },
            { label: 'Response Time', value: '< 58s', change: '-84%', up: true },
            { label: 'Booking Rate', value: '72%', change: '+31%', up: true },
          ].map((m, i) => (
            <div key={i} className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{m.label}</p>
              <p className="text-xl font-bold text-white mt-1">{m.value}</p>
              <p className={`text-xs mt-1 ${m.up ? 'text-emerald-400' : 'text-red-400'}`}>{m.change}</p>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-1 h-20 px-2">
          {[35, 42, 38, 55, 48, 62, 58, 70, 65, 78, 72, 85, 80, 92, 88, 95].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-[#5500FF] to-[#907DFF] opacity-70 hover:opacity-100 transition-opacity"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>

        <div className="flex justify-between mt-2 px-2">
          <span className="text-[10px] text-neutral-600">Jan</span>
          <span className="text-[10px] text-neutral-600">Apr</span>
          <span className="text-[10px] text-neutral-600">Jul</span>
          <span className="text-[10px] text-neutral-600">Oct</span>
        </div>

        <div className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          Live
        </div>
      </div>

      <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-[#5500FF]/20 blur-[60px]" />
      <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-[#907DFF]/15 blur-[80px]" />
    </div>
  );
}

function AutomationVisual() {
  return (
    <div className="relative w-full max-w-lg mx-auto my-12">
      <div className="space-y-3">
        {[
          { icon: '\u{1F4DE}', label: 'Incoming Call', sublabel: 'AI picks up in < 60s', active: true },
          { icon: '\u{1F916}', label: 'AI Qualification', sublabel: 'Lead scored & routed', active: true },
          { icon: '\u{1F4C5}', label: 'Auto-Booking', sublabel: 'Calendar synced', active: true },
          { icon: '\u{1F504}', label: 'Follow-Up Sequence', sublabel: '5-touch nurture', active: false },
          { icon: '\u{1F4CA}', label: 'Data Logged', sublabel: 'Command center updated', active: false },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                step.active
                  ? 'bg-[#5500FF]/20 border border-[#907DFF]/30'
                  : 'bg-white/5 border border-white/10'
              }`}>
                {step.icon}
              </div>
              {i < 4 && (
                <div className="absolute left-1/2 top-10 -translate-x-1/2 w-px h-3 bg-gradient-to-b from-[#907DFF]/40 to-transparent" />
              )}
            </div>
            <div className="flex-1 flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/5 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-white">{step.label}</p>
                <p className="text-xs text-neutral-500">{step.sublabel}</p>
              </div>
              {step.active && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white antialiased selection:bg-[#5500FF]/50 selection:text-purple-50 overflow-x-hidden">
      <GridBackground />

      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-full md:w-[1400px] h-[900px] md:h-[1100px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(98,0,255,0.35) 0%, rgba(98,0,255,0.15) 30%, rgba(144,125,255,0.06) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute bottom-[-15%] right-[-5%] w-[700px] h-[700px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.4) 0%, rgba(98,0,255,0.15) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
      </div>

      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
        scrollY > 50
          ? 'bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="text-sm font-bold tracking-[0.2em] uppercase text-white">
            Divine Acquisition
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#process" className="text-xs font-medium text-neutral-400 hover:text-white tracking-wider uppercase transition-colors">Process</a>
            <a href="#results" className="text-xs font-medium text-neutral-400 hover:text-white tracking-wider uppercase transition-colors">Results</a>
            <a href="#about" className="text-xs font-medium text-neutral-400 hover:text-white tracking-wider uppercase transition-colors">About</a>
            <Link
              href="/hiring"
              className="text-xs font-medium text-neutral-400 hover:text-white tracking-wider uppercase transition-colors"
            >
              Careers
            </Link>
            <a
              href="#cta"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_20px_rgba(85,0,255,0.4)]"
            >
              Book Consultation
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 px-6 pt-36 pb-8 md:pt-44 md:pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-8 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#907DFF]" />
            </span>
            Fractional Growth Operations for Service Businesses
          </div>

          <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-8 gradient-text-hero ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}>
            Stop Losing Revenue to Broken Operations. We Build the Infrastructure That Scales.
          </h1>

          <p className={`text-lg md:text-xl text-neutral-400 leading-relaxed font-light max-w-2xl mx-auto mb-10 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            We audit your entire operation, identify every revenue leak, and build the AI-powered systems that turn your business into a compounding growth machine — in 14 days or less.
          </p>

          <div className={`flex flex-col sm:flex-row gap-4 justify-center ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}>
            <a
              href="#cta"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.5)] hover:shadow-[0_0_50px_rgba(85,0,255,0.6)]"
            >
              Book Your Free Consultation
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>

          <p className={`text-xs text-neutral-600 mt-5 ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}>
            Trusted by service businesses generating $10K–$250K/month
          </p>

          <div className={`${mounted ? 'animate-fade-in animation-delay-500' : 'opacity-0'}`}>
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {[
            { number: '14', label: 'Day Delivery', sub: 'Guaranteed' },
            { number: '$40K+', label: 'ARR Added', sub: 'For Clients' },
            { number: '7+', label: 'Automations', sub: 'Per Engagement' },
            { number: '24/7', label: 'Communication', sub: 'Via Slack' },
          ].map((stat, i) => (
            <div
              key={i}
              className={`text-center py-10 px-4 ${
                i < 3 ? 'border-r border-white/5' : ''
              } ${i < 2 ? 'md:border-r' : ''}`}
            >
              <div className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.number}</div>
              <div className="text-sm font-medium text-neutral-300">{stat.label}</div>
              <div className="text-[10px] text-neutral-600 uppercase tracking-widest mt-1">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="relative z-10 px-6 py-24 md:py-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-4">The Problem</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text">
              Your Ads Are Working. Your Operations Aren&apos;t.
            </h2>
          </div>

          <div className="space-y-6">
            {[
              {
                stat: '27%',
                title: 'Of your calls go unanswered.',
                desc: "Every missed call is a customer who calls your competitor instead. 85% of them never call back.",
              },
              {
                stat: '42hrs',
                title: 'Average lead response time.',
                desc: "Harvard research shows you're 21x more likely to convert if you respond in 5 minutes. Most service businesses take nearly two days.",
              },
              {
                stat: '68%',
                title: 'Of customers never rebook.',
                desc: "One-time jobs are the silent killer of service businesses. Without a retention system, you're rebuilding your revenue from zero every month.",
              },
              {
                stat: '$0',
                title: 'Spent on systems that compound.',
                desc: "You're investing in ads that bring people in the front door while the back door is wide open. Every dollar spent on acquisition without infrastructure is a dollar half-wasted.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex gap-6 md:gap-8 p-6 rounded-xl border-l-2 border-[#5500FF]/40 bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
              >
                <div className="text-3xl md:text-4xl font-bold text-[#907DFF] shrink-0 w-20 md:w-24 tabular-nums group-hover:text-white transition-colors">
                  {item.stat}
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm md:text-base text-neutral-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.4)]"
            >
              See What You&apos;re Losing — Free Consultation
            </a>
          </div>
        </div>
      </section>

      {/* SECTION DIVIDER */}
      <div className="w-full flex justify-center">
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#907DFF]/50 to-transparent" />
      </div>

      {/* A.I.R. FRAMEWORK */}
      <section id="process" className="relative z-10 px-6 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-4">The A.I.R. Framework</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text max-w-2xl mx-auto">
              We Build Growth Infrastructure That Compounds
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {pillars.map((pillar, i) => (
              <div
                key={i}
                className="group relative rounded-2xl bg-[#111]/60 border border-white/[0.06] p-8 hover:border-[#907DFF]/30 hover:bg-[#111]/80 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_60px_-15px_rgba(85,0,255,0.15)] overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#907DFF]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#5500FF]/10 border border-[#907DFF]/20 flex items-center justify-center text-[#907DFF]">
                      {pillar.icon}
                    </div>
                    <span className="text-[10px] font-bold text-[#907DFF] uppercase tracking-widest">{pillar.highlight}</span>
                  </div>
                  <span className="text-5xl font-bold text-white/[0.04] leading-none">{pillar.num}</span>
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">{pillar.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>

          <div className="max-w-lg mx-auto mt-16">
            <AutomationVisual />
          </div>
        </div>
      </section>

      <div className="w-full flex justify-center">
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#907DFF]/50 to-transparent" />
      </div>

      {/* SOCIAL PROOF */}
      <section id="results" className="relative z-10 px-6 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-4">Proven Results</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text">
              Real Businesses. Real Infrastructure. Real Revenue.
            </h2>
          </div>

          {/* Featured Case Study */}
          <div className="relative rounded-2xl border border-[#907DFF]/15 bg-gradient-to-br from-[#5500FF]/[0.04] to-transparent p-8 md:p-12 mb-8 overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#5500FF] via-[#907DFF] to-transparent" />

            <span className="inline-block text-[10px] font-bold text-[#907DFF] uppercase tracking-widest mb-5">Featured Engagement</span>

            <h3 className="text-2xl md:text-3xl font-bold text-white mb-5">
              BadgerLuxClean — Data Command Center Build
            </h3>

            <p className="text-base text-neutral-400 leading-relaxed mb-10 max-w-3xl">
              A residential cleaning company drowning in manual processes and disconnected data. We built a complete Google Sheets Data Command Center, 7 Zapier automation workflows triggered by BookingKoala webhooks, and a Retention OS layer — with a roadmap toward a custom web dashboard.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { num: '7', label: 'Automated Workflows' },
                { num: 'Multi-Phase', label: 'Data Architecture' },
                { num: '$3,500', label: 'Launch Package' },
                { num: '$450+/mo', label: 'Growth Retainer' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="text-2xl font-bold text-white mb-1">{item.num}</div>
                  <div className="text-[10px] text-neutral-500 uppercase tracking-widest">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#111]/60 border border-white/[0.06] p-7 hover:border-[#907DFF]/20 transition-all duration-300"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-[#907DFF]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed mb-6 italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="mb-4">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{t.role}</p>
                </div>
                <span className="inline-block px-3 py-1.5 rounded-full bg-[#5500FF]/10 border border-[#907DFF]/20 text-[10px] font-semibold text-[#907DFF] tracking-wide">
                  {t.result}
                </span>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.4)]"
            >
              Get Your Growth Infrastructure Built
            </a>
          </div>
        </div>
      </section>

      <div className="w-full flex justify-center">
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#907DFF]/50 to-transparent" />
      </div>

      {/* PROCESS TIMELINE */}
      <section className="relative z-10 px-6 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-4">Our Process</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text">
              From Audit to Infrastructure in 14 Days
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {processSteps.map((step, i) => (
              <div
                key={i}
                className="group relative rounded-2xl bg-[#111]/60 border border-white/[0.06] p-8 hover:border-[#907DFF]/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-15px_rgba(85,0,255,0.1)]"
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#5500FF]/10 border border-[#907DFF]/20 flex items-center justify-center text-xs font-bold text-[#907DFF]">
                      {i + 1}
                    </div>
                    <span className="text-[10px] font-bold text-[#907DFF] uppercase tracking-widest">{step.phase}</span>
                  </div>
                  <span className="text-xs text-neutral-500 font-medium">{step.day}</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{step.items}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.4)]"
            >
              Start Your 14-Day Build
            </a>
          </div>
        </div>
      </section>

      <div className="w-full flex justify-center">
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#907DFF]/50 to-transparent" />
      </div>

      {/* COMPARISON TABLE */}
      <section className="relative z-10 px-6 py-24 md:py-32">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-4">The Difference</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text">
              Divine Acquisition vs. The Alternatives
            </h2>
          </div>

          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px] md:grid-cols-[1fr_100px_100px] items-center px-6 py-4 bg-[#5500FF]/[0.06] border-b border-white/5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Feature</span>
              <span className="text-[10px] font-bold text-[#907DFF] uppercase tracking-widest text-center">DA</span>
              <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest text-center">Others</span>
            </div>

            {comparisonFeatures.map((feature, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_80px_80px] md:grid-cols-[1fr_100px_100px] items-center px-6 py-4 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-sm text-neutral-300">{feature}</span>
                <span className="text-center">
                  <svg className="w-5 h-5 text-emerald-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-center">
                  <svg className="w-5 h-5 text-neutral-700 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.4)]"
            >
              Choose Divine Acquisition
            </a>
          </div>
        </div>
      </section>

      <div className="w-full flex justify-center">
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#907DFF]/50 to-transparent" />
      </div>

      {/* FOUNDER SECTION */}
      <section id="about" className="relative z-10 px-6 py-24 md:py-32">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-4">The Founder</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text mb-3">
              From the Desk of Malik
            </h2>
            <p className="text-sm text-neutral-500">Founder, Divine Acquisition</p>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-[#111]/60 p-8 md:p-12">
            <div className="space-y-5 text-base text-neutral-400 leading-relaxed">
              <p>I didn&apos;t start Divine Acquisition with a theory. I started it with a cleaning company.</p>

              <p>I built NovaraCleaning from scratch — 10 contractors, DMV market, every system automated. AI voice agents handling calls. GHL workflows managing the full client lifecycle. Zapier connecting everything. Custom booking interfaces. Retention sequences that convert one-time cleans into recurring accounts.</p>

              <p>Then I realized: the systems I built to run my own company were more valuable than the cleaning jobs themselves. Other service business owners were drowning in the same chaos I&apos;d already solved — missed leads, manual follow-up, zero data visibility, no retention strategy.</p>

              <p>So I started building for them. And the results spoke for themselves.</p>

              <p className="text-white font-medium border-l-2 border-[#5500FF]/40 pl-6 py-2">
                Divine Acquisition exists because I believe every service business deserves the operational infrastructure that billion-dollar companies take for granted. You shouldn&apos;t need a VC-backed tech team to have systems that actually work.
              </p>

              <p>If you&apos;re tired of duct-taping your operations together and ready to build something that compounds — I&apos;d like to talk.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="w-full flex justify-center">
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#907DFF]/50 to-transparent" />
      </div>

      {/* FAQ */}
      <section className="relative z-10 px-6 py-24 md:py-32">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-4">Questions</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`rounded-xl border transition-all duration-300 ${
                  activeFaq === i
                    ? 'border-[#907DFF]/20 bg-white/[0.03]'
                    : 'border-white/[0.04] hover:border-white/[0.08] bg-transparent'
                }`}
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                >
                  <h3 className={`text-base font-medium pr-8 transition-colors ${
                    activeFaq === i ? 'text-white' : 'text-neutral-300'
                  }`}>
                    {faq.q}
                  </h3>
                  <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                    activeFaq === i
                      ? 'bg-[#5500FF]/10 border-[#907DFF]/30 rotate-45'
                      : 'bg-white/[0.03] border-white/10'
                  }`}>
                    <svg className="w-4 h-4 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    activeFaq === i ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="px-6 pb-6 text-sm text-neutral-400 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="cta" className="relative z-10 px-6 py-24 md:py-32 border-t border-white/5">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(85,0,255,0.15) 0%, transparent 70%)',
              filter: 'blur(60px)',
            }}
          />
        </div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <span className="inline-block text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-5">Ready to Build?</span>

          <h2 className="text-3xl md:text-5xl font-bold tracking-tight gradient-text-hero mb-6">
            Stop Guessing. Start Building Infrastructure That Compounds.
          </h2>

          <p className="text-base md:text-lg text-neutral-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Book a free consultation. We&apos;ll show you exactly where you&apos;re leaving money on the table — and what the fix looks like.
          </p>

          <a
            href="#"
            className="inline-flex items-center gap-2 px-10 py-5 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_40px_rgba(85,0,255,0.5)] hover:shadow-[0_0_60px_rgba(85,0,255,0.6)] animate-pulse-glow"
          >
            Book Your Free Consultation
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>

          <p className="text-xs text-neutral-600 mt-5">No obligation. No sales pitch. Just an honest assessment.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <Link href="/" className="text-xs font-bold tracking-[0.2em] uppercase text-white">
            Divine Acquisition
          </Link>
          <span className="text-xs text-neutral-600">
            Devotion. Value. Exclusivity.
          </span>
          <div className="flex items-center gap-4">
            <Link href="/hiring" className="text-xs text-neutral-500 hover:text-white transition-colors">
              Careers
            </Link>
            <span className="text-xs text-neutral-600">
              &copy; 2026 Divine Acquisition. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
