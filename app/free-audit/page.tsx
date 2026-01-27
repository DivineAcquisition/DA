'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';

const problemPoints = [
  {
    title: "Users sign up but never activate",
    description: "The average SaaS activation rate is just 37.5%. If users don't engage within the first 3 days, they have a 90% chance of churning."
  },
  {
    title: "Customers cancel and you don't know why",
    description: "No exit survey. No save attempt. No data. Just lost revenue you could have prevented."
  },
  {
    title: "Your onboarding is leaking users",
    description: "Poor onboarding causes 40-60% drop-off after signup. 80% of users uninstall apps because they don't understand how to use them."
  },
  {
    title: "You're guessing what to fix",
    description: "You have analytics tools collecting data. But no clear action plan for what's actually causing churn."
  },
  {
    title: "Your cancellation flow is just a button",
    description: "A proper cancellation flow can save 25-30% of customers who would have left. Most founders have nothing."
  }
];

const stats = [
  { number: "5%", label: "Monthly churn = 40% of customers replaced yearly just to stay flat" },
  { number: "$2.00", label: "Median cost to acquire $1 of new ARR in 2024 — up 14% from last year" },
  { number: "23 mo", label: "Average CAC payback period — you're losing money on new customers for nearly 2 years" },
  { number: "5-25x", label: "More expensive to acquire than retain — yet 44% of companies still prioritize acquisition" },
];

const opportunities = [
  {
    stat: "5%",
    title: "retention improvement = 25-95% profit increase",
    description: "Retention compounds. Acquisition doesn't."
  },
  {
    stat: "25-30%",
    title: "of churning customers saved by cancellation flows",
    description: "Most SaaS have nothing between \"cancel\" and \"goodbye.\" That's money walking out the door."
  },
  {
    stat: "2.5x",
    title: "faster growth for retention-focused companies",
    description: "Yet only 18% of SaaS companies spend more on retention than acquisition."
  },
  {
    stat: "1.5%",
    title: "churn rate achieved by top performers",
    description: "The difference between 5% and 1.5% churn is replacing 40% of customers yearly vs. 17%."
  }
];

const auditItems = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    title: "Churn Diagnosis",
    description: "We'll look at your metrics and identify where users are dropping off and why. Not theories — patterns in your data."
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Onboarding Teardown",
    description: "Is your activation path clear or confusing? We'll find the friction that's killing conversions in the first 7 days."
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Retention Systems Check",
    description: "Exit surveys, save offers, health scoring, win-back campaigns — we'll audit what's missing from your stack."
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
    title: "3-5 Prioritized Fixes",
    description: "Walk away with specific, actionable recommendations ranked by impact. Not a 50-page report — a short list you can act on this week."
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "ROI Calculation",
    description: "See exactly what fixing your churn is worth in dollars. If you're at 5% monthly churn and drop to 3%, we'll show you the revenue impact."
  }
];

const steps = [
  {
    number: "01",
    title: "Book a 30-minute call",
    description: "Pick a time that works. Fill out a quick intake form so I come prepared with questions."
  },
  {
    number: "02",
    title: "Walk me through your product",
    description: "Share your screen. Show me signup, onboarding, and cancellation. I'll ask the questions most founders never think to ask."
  },
  {
    number: "03",
    title: "Get your action plan",
    description: "Within 24 hours, you'll have a summary email with your metrics, the leaks I found, and exactly how to fix them."
  }
];

const goodFit = [
  "You run a B2B SaaS doing $1K - $100K MRR",
  "You have paying customers but churn is higher than you'd like",
  "You don't have a dedicated customer success team yet",
  "You want honest feedback — not a pitch disguised as a consultation",
  "You're ready to implement, not just collect ideas"
];

const notFit = [
  "You haven't launched yet or have no paying users",
  "You already have a full CS team and established retention systems",
  "You're looking for someone to do it all for you (this is strategy, not done-for-you)"
];

const faqs = [
  {
    q: "Is this actually free?",
    a: "Yes. No credit card. No hidden upsell on the call. 30 minutes of real feedback."
  },
  {
    q: "What do I need to prepare?",
    a: "Be ready to share your screen and walk me through your signup → onboarding → cancellation flow. Know your basic metrics (MRR, churn rate, customer count) if you have them."
  },
  {
    q: "Will you try to sell me something?",
    a: "No pitch on the call. If there's a fit to work together, I'll mention it briefly at the end. But the audit is valuable whether you hire me or not."
  },
  {
    q: "Why are you doing this for free?",
    a: "I'm building my consulting practice and want real experience with real SaaS products. You get free strategy. I get reps and case studies. Fair trade."
  },
  {
    q: "What happens after the call?",
    a: "Within 24 hours, you'll get a summary email with your metrics, the leaks I found, and prioritized fixes. It's yours to keep and implement."
  },
  {
    q: "How many free audits are you doing?",
    a: "5 per month. Once they're booked, the calendar closes until next month."
  },
  {
    q: "What kind of results can I expect?",
    a: "That depends on your current state. But the research shows: cancellation flows alone save 25-30% of churning customers, and a 5% retention improvement can increase profits 25-95%. Small fixes compound."
  }
];

export default function FreeAuditPage() {
  const [mounted, setMounted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white antialiased selection:bg-[#5500FF]/50 selection:text-purple-50 overflow-x-hidden">
      
      {/* MsgSndr Calendar Script */}
      <Script src="https://link.msgsndr.divineacquisition.io/js/form_embed.js" strategy="lazyOnload" />

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

      {/* Background Glow Effects - Deep #6200FF for banner */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Main banner glow - deep purple #6200FF */}
        <div 
          className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-full md:w-[1400px] h-[900px] md:h-[1100px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(98,0,255,0.5) 0%, rgba(98,0,255,0.25) 30%, rgba(144,125,255,0.1) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Bottom right glow - #907DFF accent */}
        <div 
          className="absolute bottom-[-15%] right-[-5%] w-[700px] h-[700px] rounded-full opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.5) 0%, rgba(98,0,255,0.2) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Left side glow */}
        <div 
          className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.4) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-28 border-b border-white/5 bg-[#0a0a0a]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/free-audit" className="group">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={200} 
              height={200}
              className="group-hover:opacity-80 transition-opacity"
            />
          </Link>
          
          <a
            href="#book-audit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.5)]"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            Book Free Audit
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-44 pb-16 md:pt-52 md:pb-20">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div 
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
                        text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/40 mb-8
                        shadow-[0_0_40px_-5px_rgba(144,125,255,0.6)]
                        ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#907DFF] shadow-[0_0_10px_rgba(144,125,255,0.8)]" />
            </span>
            Limited: 5 Free Spots This Month
          </div>

          {/* Headline */}
          <h1 
            className={`text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-6 leading-[1.15] text-transparent bg-clip-text
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 30%, #907DFF 60%, #5500FF 100%)',
            }}
          >
            Find Out Exactly Why Your Users Are Churning
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-xl text-neutral-400 leading-relaxed font-light max-w-2xl mx-auto mb-12
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            Get a free 30-minute retention audit and walk away with 3-5 specific fixes you can implement this week. No pitch. Just actionable feedback.
          </p>

          {/* CTA & Trust Line */}
          <div 
            className={`flex flex-col items-center gap-6
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            <a
              href="#book-audit"
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-full text-base font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_40px_rgba(85,0,255,0.5)]"
            >
              Book Your Free Audit
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
            <p className="text-sm text-neutral-500 max-w-md">
              For SaaS founders doing $1K-100K MRR who want honest answers, not another sales call.
            </p>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="relative z-10 px-6 py-20 md:py-24">
        <div className="max-w-4xl mx-auto">
          <div className={`mb-12 text-center ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-6">
              The Problem
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
            }}>
              You&apos;re paying to acquire customers you can&apos;t keep
            </h2>
          </div>

          <div className={`space-y-4 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {problemPoints.map((point, index) => (
              <div
                key={index}
                className="group relative p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-red-500/30 hover:shadow-[0_0_30px_rgba(239,68,68,0.1)] transition-all duration-300 overflow-hidden"
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-red-500/10 blur-[60px]" />
                </div>
                
                <div className="relative flex items-start gap-5">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0 mt-1">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2 group-hover:text-red-300 transition-colors">{point.title}</h3>
                    <p className="text-neutral-500 font-light leading-relaxed">{point.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cost of Churn Section */}
      <section className="relative z-10 px-6 py-20 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className={`mb-12 text-center ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-6">
              The Cost
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
            }}>
              The math on ignoring retention
            </h2>
          </div>

          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {stats.map((stat, index) => (
              <div key={index} className="relative p-6 md:p-8 rounded-2xl bg-[#111111] border border-white/10 text-center hover:border-[#907DFF]/30 hover:shadow-[0_0_30px_rgba(144,125,255,0.1)] transition-all duration-300">
                <p className="text-3xl md:text-4xl font-semibold text-transparent bg-clip-text mb-3" style={{
                  backgroundImage: 'linear-gradient(to right, white 0%, #907DFF 100%)',
                }}>
                  {stat.number}
                </p>
                <p className="text-sm text-neutral-500 font-light leading-relaxed">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className={`relative p-8 md:p-10 rounded-2xl bg-[#111111] border border-red-500/20 ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-red-500/10 blur-[80px]" />
            </div>
            <p className="relative text-center text-lg text-neutral-300 font-light leading-relaxed">
              Every dollar you spend acquiring customers who churn is a dollar wasted. <span className="text-white font-medium">Retention isn&apos;t a &quot;nice to have&quot; — it&apos;s survival.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Opportunity Section */}
      <section className="relative z-10 px-6 py-20 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className={`mb-12 text-center ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-6">
              The Opportunity
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
            }}>
              Small retention improvements create massive results
            </h2>
          </div>

          <div className={`grid md:grid-cols-2 gap-4 md:gap-6 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {opportunities.map((item, index) => (
              <div key={index} className="group relative p-6 md:p-8 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#907DFF]/50 hover:shadow-[0_0_30px_rgba(144,125,255,0.25),inset_0_0_20px_rgba(144,125,255,0.05)] transition-all duration-300 overflow-hidden">
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-[#907DFF]/20 blur-[60px]" />
                </div>
                
                <div className="relative">
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-semibold text-transparent bg-clip-text" style={{
                      backgroundImage: 'linear-gradient(to right, #907DFF 0%, #5500FF 100%)',
                    }}>
                      {item.stat}
                    </span>
                    <span className="text-lg text-white font-light group-hover:text-[#907DFF] transition-colors">{item.title}</span>
                  </div>
                  <p className="text-neutral-500 font-light">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className="relative z-10 px-6 py-20 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className={`mb-12 text-center ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-6">
              What&apos;s Included
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
            }}>
              What&apos;s included in your free audit
            </h2>
          </div>

          <div className={`grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {auditItems.map((item, index) => (
              <div
                key={index}
                className="group relative p-6 md:p-8 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#907DFF]/50 hover:shadow-[0_0_30px_rgba(144,125,255,0.25),inset_0_0_20px_rgba(144,125,255,0.05)] transition-all duration-300 overflow-hidden"
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-[#907DFF]/20 blur-[60px]" />
                </div>
                
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[#907DFF]/15 border border-[#907DFF]/20 flex items-center justify-center text-[#907DFF] mb-5 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(144,125,255,0.4)] transition-all">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-medium text-white mb-3 group-hover:text-[#907DFF] transition-colors">{item.title}</h3>
                  <p className="text-neutral-500 font-light text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 px-6 py-20 md:py-24">
        <div className="max-w-3xl mx-auto">
          <div className={`mb-12 text-center ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-6">
              How It Works
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
            }}>
              Simple. Fast. Actionable.
            </h2>
          </div>

          <div className={`space-y-4 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {steps.map((step, index) => (
              <div
                key={index}
                className="group relative p-6 md:p-8 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#907DFF]/50 hover:shadow-[0_0_30px_rgba(144,125,255,0.25),inset_0_0_20px_rgba(144,125,255,0.05)] transition-all duration-300 overflow-hidden"
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-[#907DFF]/20 blur-[60px]" />
                </div>
                
                <div className="relative flex items-start gap-6">
                  <div className="w-14 h-14 rounded-xl bg-[#907DFF]/15 border border-[#907DFF]/20 flex items-center justify-center flex-shrink-0 group-hover:shadow-[0_0_20px_rgba(144,125,255,0.4)] transition-all">
                    <span className="text-lg font-semibold text-[#907DFF]">{step.number}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white mb-2 group-hover:text-[#907DFF] transition-colors">{step.title}</h3>
                    <p className="text-neutral-400 font-light leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who This Is For Section */}
      <section className="relative z-10 px-6 py-20 md:py-24">
        <div className="max-w-4xl mx-auto">
          <div className={`mb-12 text-center ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-6">
              Fit Check
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
            }}>
              Is this for you?
            </h2>
          </div>

          <div className={`grid md:grid-cols-2 gap-6 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {/* Good Fit */}
            <div className="relative p-6 md:p-8 rounded-2xl bg-[#111111] border border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-emerald-500/10 blur-[60px]" />
              </div>
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-emerald-400">Good Fit</h3>
                </div>
                <ul className="space-y-4">
                  {goodFit.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-neutral-400 font-light text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Not a Fit */}
            <div className="relative p-6 md:p-8 rounded-2xl bg-[#111111] border border-red-500/30 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)] transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-red-500/10 blur-[60px]" />
              </div>
              
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-red-400">Not a Fit</h3>
                </div>
                <ul className="space-y-4">
                  {notFit.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-neutral-400 font-light text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="relative z-10 px-6 py-20 md:py-24">
        <div className="max-w-3xl mx-auto">
          <div className={`mb-10 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-6">
              About
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
            }}>
              Who&apos;s behind the audit?
            </h2>
          </div>

          <div className={`relative p-8 md:p-10 rounded-2xl bg-[#111111] border border-white/10 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            <div className="space-y-5 text-neutral-400 font-light leading-relaxed">
              <p>
                I&apos;m <span className="text-white font-medium">Malik</span>, founder of Divine Acquisition.
              </p>
              <p>
                I help SaaS companies find and fix the leaks in their retention systems — the places where customers slip away that most founders never think to look.
              </p>
              <p>
                Most founders are laser-focused on acquisition. But the data is clear: <span className="text-neutral-300">it costs 5-25x more to acquire a customer than to keep one.</span> And 75% of software companies saw declining retention last year despite spending more.
              </p>
              <p>
                The problem isn&apos;t usually the product. It&apos;s the systems around the product — onboarding that confuses, engagement that disappears, cancellation flows that don&apos;t exist.
              </p>
              <p>
                I&apos;m offering free audits because I want to help founders who are serious about fixing this — and I want real reps with real products.
              </p>
              <p className="text-neutral-300">
                This isn&apos;t a pitch call. It&apos;s 30 minutes of honest feedback. If we&apos;re a fit to work together after, great. If not, you still walk away knowing exactly what to fix.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 px-6 py-20 md:py-24">
        <div className="max-w-3xl mx-auto">
          <div className={`mb-12 text-center ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-6">
              FAQ
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
            }}>
              Questions
            </h2>
          </div>

          <div className={`space-y-3 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="relative rounded-2xl bg-[#111111] border border-white/10 overflow-hidden transition-all duration-300 hover:border-[#907DFF]/30"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4"
                >
                  <span className="text-white font-medium">{faq.q}</span>
                  <div className={`w-8 h-8 rounded-full bg-[#907DFF]/10 border border-[#907DFF]/20 flex items-center justify-center flex-shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`}>
                    <svg 
                      className="w-4 h-4 text-[#907DFF]" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === index ? 'max-h-96' : 'max-h-0'}`}>
                  <div className="px-6 pb-6">
                    <p className="text-neutral-400 font-light leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative z-10 px-6 py-20 md:py-24" id="book-audit">
        <div className="max-w-4xl mx-auto">
          <div className={`relative p-8 md:p-12 rounded-2xl bg-[#111111] border border-white/10 overflow-hidden ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-[-50%] left-1/2 -translate-x-1/2 w-[800px] h-[600px]" style={{
                background: 'radial-gradient(ellipse at center, rgba(98,0,255,0.3) 0%, rgba(144,125,255,0.15) 40%, transparent 70%)',
                filter: 'blur(60px)',
              }} />
            </div>
            
            <div className="relative">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
                  backgroundImage: 'linear-gradient(to right, white 0%, white 40%, #907DFF 80%, #5500FF 100%)',
                }}>
                  Ready to find out what&apos;s killing your retention?
                </h2>
                <p className="text-neutral-400 font-light max-w-lg mx-auto mb-3">
                  30 minutes. 3-5 actionable fixes. Zero pitch.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#907DFF] shadow-[0_0_10px_rgba(144,125,255,0.8)]" />
                  </span>
                  5 spots available this month
                </div>
              </div>

              {/* MsgSndr Calendar Widget */}
              <div className="rounded-xl overflow-hidden border border-white/10">
                <iframe 
                  src="https://link.msgsndr.divineacquisition.io/widget/booking/1aYFzQE1WdCv1FUKsZsQ" 
                  style={{ width: '100%', border: 'none', overflow: 'hidden', minHeight: '700px' }}
                  scrolling="no"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Link href="/free-audit">
                <Image 
                  src="/6 (0-00-00-00)_1.png" 
                  alt="Divine Acquisition" 
                  width={32} 
                  height={32}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                />
              </Link>
              <span className="text-neutral-500 text-xs font-medium">
                2026 © DivineAcquisition™, All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-5">
              <a href="https://x.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Twitter
              </a>
              <a href="mailto:hello@divineacquisition.com" className="text-[10px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Contact
              </a>
              <a href="https://go.divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
