'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';

const problemPoints = [
  {
    title: "Users sign up but never activate",
    description: "They hit your paywall or first friction point and disappear."
  },
  {
    title: "Customers cancel and you don't know why",
    description: "No exit survey. No save attempt. No data. Just lost revenue."
  },
  {
    title: "You're guessing what to fix",
    description: "You have Mixpanel, Amplitude, Intercom — but no clear action plan."
  },
  {
    title: "No system for at-risk users",
    description: "By the time you notice they're gone, they're already gone."
  },
  {
    title: "Your cancellation flow is just a button",
    description: "One click and they're out. No conversation. No second chance."
  }
];

const stats = [
  { number: "5%", label: "Monthly churn = 46% annual customer loss" },
  { number: "$45K+", label: "Revenue lost per year at $10K MRR with 5% churn" },
  { number: "10-30%", label: "Cancellations saveable with a proper flow" },
  { number: "5x", label: "Cheaper to retain than acquire" },
];

const auditItems = [
  {
    title: "Churn Diagnosis",
    description: "We'll look at where users drop off and identify the real reasons they're leaving."
  },
  {
    title: "Onboarding Teardown",
    description: "Is your activation path clear or confusing? We'll find the friction killing conversions."
  },
  {
    title: "Retention Systems Check",
    description: "What's missing from your stack? Exit surveys, save offers, win-back campaigns — we'll audit it all."
  },
  {
    title: "3-5 Prioritized Fixes",
    description: "Walk away with specific, actionable recommendations you can implement this week."
  },
  {
    title: "ROI Calculation",
    description: "See exactly what fixing your churn is worth in dollars — not theory."
  }
];

const steps = [
  {
    number: "01",
    title: "Book a 30-minute call",
    description: "Pick a time that works. Fill out a quick intake form so I come prepared."
  },
  {
    number: "02",
    title: "Walk me through your product",
    description: "Share your screen. Show me signup, onboarding, and cancellation. I'll ask questions."
  },
  {
    number: "03",
    title: "Get your action plan",
    description: "I'll identify the biggest leaks and tell you exactly how to fix them. No fluff."
  }
];

const goodFit = [
  "You run a B2B SaaS doing $1K - $100K MRR",
  "You have paying customers but struggle with retention",
  "You don't have a dedicated customer success team yet",
  "You want honest feedback — not a sales pitch",
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
    a: "Yes. No credit card. No hidden upsell on the call. Just 30 minutes of feedback."
  },
  {
    q: "What do I need to prepare?",
    a: "Be ready to share your screen and walk me through your signup → onboarding → cancellation flow. Know your basic metrics (MRR, churn rate, customer count)."
  },
  {
    q: "Will you try to sell me something?",
    a: "No pitch on the call. If there's a fit to work together, I'll mention it at the end. But the audit is valuable whether you hire me or not."
  },
  {
    q: "Why are you doing this for free?",
    a: "I'm building my consulting practice and want real reps with real SaaS products. You get free strategy. I get experience and case studies. Fair trade."
  },
  {
    q: "What happens after the call?",
    a: "Within 24 hours, I'll send you a summary email with everything we discussed — your metrics, the leaks I found, and the prioritized fixes. It's yours to keep."
  },
  {
    q: "How many free audits are you doing?",
    a: "5 per month. Once they're booked, the page comes down until next month."
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
      
      {/* iClosed Script */}
      <Script src="https://app.iclosed.io/assets/widget.js" strategy="lazyOnload" />

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
          className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-full md:w-[1600px] h-[1000px] md:h-[1200px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(98,0,255,0.4) 0%, rgba(98,0,255,0.15) 30%, rgba(144,125,255,0.05) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute bottom-[-10%] left-[-10%] w-[800px] h-[800px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.5) 0%, rgba(98,0,255,0.2) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        <div 
          className="absolute top-[50%] right-[-5%] w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.4) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-white/5 bg-[#0a0a0a]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/free-audit" className="group flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={160} 
              height={160}
              className="group-hover:opacity-80 transition-opacity"
            />
          </Link>
          
          <a
            href="#book-audit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.5)] hover:shadow-[0_0_40px_rgba(85,0,255,0.7)]"
          >
            Book Free Audit
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div 
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
                        text-amber-300 bg-amber-500/10 border border-amber-500/40 mb-8
                        shadow-[0_0_40px_-5px_rgba(251,191,36,0.4)]
                        ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Limited: 5 Free Spots This Month
          </div>

          {/* Headline */}
          <h1 
            className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 leading-[1.1] text-transparent bg-clip-text
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 80%, #5500FF 100%)',
            }}
          >
            Find Out Exactly Why Your Users Are Churning
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-lg md:text-xl text-neutral-400 leading-relaxed font-light max-w-2xl mx-auto mb-10
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            Get a free 30-minute retention audit and walk away with 3-5 specific fixes you can implement this week.
          </p>

          {/* CTA Buttons */}
          <div 
            className={`flex flex-col items-center gap-4
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            <a
              href="#book-audit"
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-full text-base font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_40px_rgba(85,0,255,0.5)] hover:shadow-[0_0_60px_rgba(85,0,255,0.7)]"
            >
              Book Your Free Audit
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
            <p className="text-sm text-neutral-500">No pitch. No obligation. Just actionable feedback.</p>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="relative z-10 px-6 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <div className={`text-center mb-16 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, #907DFF 100%)',
            }}>
              You&apos;re spending money to acquire customers you can&apos;t keep
            </h2>
          </div>

          <div className={`space-y-4 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {problemPoints.map((point, index) => (
              <div
                key={index}
                className="group relative p-6 rounded-2xl bg-[#111111]/80 border border-white/10 hover:border-red-500/30 hover:shadow-[0_0_30px_rgba(239,68,68,0.1)] transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{point.title}</h3>
                    <p className="text-neutral-400 font-light">{point.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cost of Churn Section */}
      <section className="relative z-10 px-6 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <div className={`text-center mb-16 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, #907DFF 100%)',
            }}>
              The math on ignoring retention
            </h2>
          </div>

          <div className={`grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {stats.map((stat, index) => (
              <div key={index} className="relative p-6 rounded-2xl bg-[#111111]/80 border border-[#907DFF]/20 text-center">
                <p className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text mb-2" style={{
                  backgroundImage: 'linear-gradient(135deg, white 0%, #907DFF 100%)',
                }}>
                  {stat.number}
                </p>
                <p className="text-sm text-neutral-400 font-light">{stat.label}</p>
              </div>
            ))}
          </div>

          <p className={`text-center text-lg text-neutral-300 font-light max-w-3xl mx-auto ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}>
            Every month you wait, you&apos;re paying for customers twice — once to get them, once to replace them.
          </p>
        </div>
      </section>

      {/* What You Get Section */}
      <section className="relative z-10 px-6 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <div className={`text-center mb-16 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-6">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              What&apos;s Included
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, #907DFF 100%)',
            }}>
              What&apos;s included in your free audit
            </h2>
          </div>

          <div className={`grid md:grid-cols-2 lg:grid-cols-3 gap-6 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {auditItems.map((item, index) => (
              <div
                key={index}
                className="group relative p-6 rounded-2xl bg-[#111111]/80 border border-white/10 hover:border-[#907DFF]/50 hover:shadow-[0_0_40px_rgba(144,125,255,0.15)] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5500FF]/20 to-[#907DFF]/10 border border-[#907DFF]/30 flex items-center justify-center text-[#907DFF] mb-4">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#907DFF] transition-colors">{item.title}</h3>
                <p className="text-neutral-400 font-light text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative z-10 px-6 py-20 md:py-28">
        <div className="max-w-4xl mx-auto">
          <div className={`text-center mb-16 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, #907DFF 100%)',
            }}>
              Simple. Fast. Actionable.
            </h2>
          </div>

          <div className={`space-y-6 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {steps.map((step, index) => (
              <div
                key={index}
                className="relative p-6 md:p-8 rounded-2xl bg-[#111111]/80 border border-white/10"
              >
                <div className="flex items-start gap-6">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#5500FF]/30 to-[#907DFF]/20 border border-[#907DFF]/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-[#907DFF]">{step.number}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-neutral-400 font-light">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who This Is For Section */}
      <section className="relative z-10 px-6 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <div className={`text-center mb-16 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, #907DFF 100%)',
            }}>
              Is this for you?
            </h2>
          </div>

          <div className={`grid md:grid-cols-2 gap-8 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {/* Good Fit */}
            <div className="relative p-6 md:p-8 rounded-2xl bg-[#111111]/80 border border-green-500/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-green-400">Good Fit</h3>
              </div>
              <ul className="space-y-3">
                {goodFit.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-neutral-300 font-light text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Not a Fit */}
            <div className="relative p-6 md:p-8 rounded-2xl bg-[#111111]/80 border border-red-500/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-red-400">Not a Fit</h3>
              </div>
              <ul className="space-y-3">
                {notFit.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-neutral-300 font-light text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="relative z-10 px-6 py-20 md:py-28">
        <div className="max-w-3xl mx-auto">
          <div className={`text-center mb-10 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, #907DFF 100%)',
            }}>
              Who&apos;s behind the audit?
            </h2>
          </div>

          <div className={`relative p-8 md:p-10 rounded-2xl bg-[#111111]/80 border border-white/10 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            <div className="space-y-4 text-neutral-300 font-light leading-relaxed">
              <p>
                I&apos;m <span className="text-white font-medium">Malik</span>, founder of Divine Acquisition. I help SaaS companies build retention systems that stop the leak.
              </p>
              <p>
                Most founders are laser-focused on acquisition. But if your bucket has holes, more water won&apos;t help.
              </p>
              <p>
                I&apos;ve spent years studying why users churn and building systems to prevent it. Now I&apos;m offering free audits to help founders like you — and sharpen my own skills in the process.
              </p>
              <p>
                <span className="text-white font-medium">This isn&apos;t a pitch disguised as a consultation.</span> It&apos;s 30 minutes of real, actionable feedback.
              </p>
              <p>
                If we&apos;re a fit to work together after, great. If not, you still walk away knowing exactly what to fix.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 px-6 py-20 md:py-28">
        <div className="max-w-3xl mx-auto">
          <div className={`text-center mb-16 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, #907DFF 100%)',
            }}>
              Questions
            </h2>
          </div>

          <div className={`space-y-4 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="relative rounded-2xl bg-[#111111]/80 border border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4"
                >
                  <span className="text-white font-medium">{faq.q}</span>
                  <svg 
                    className={`w-5 h-5 text-[#907DFF] flex-shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-6">
                    <p className="text-neutral-400 font-light">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative z-10 px-6 py-20 md:py-28" id="book-audit">
        <div className="max-w-4xl mx-auto">
          <div className={`relative p-8 md:p-12 rounded-3xl bg-[#111111]/90 border border-[#907DFF]/30 shadow-[0_0_80px_rgba(144,125,255,0.15)] overflow-hidden ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#5500FF]/20 blur-[100px]" />
            </div>
            
            <div className="relative">
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
                  backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
                }}>
                  Ready to find out what&apos;s killing your retention?
                </h2>
                <p className="text-neutral-400 font-light max-w-lg mx-auto mb-2">
                  30 minutes. 3-5 actionable fixes. Zero pitch.
                </p>
                <p className="text-amber-300 text-sm font-medium">5 spots available this month.</p>
              </div>

              {/* iClosed Calendar Widget */}
              <div 
                className="iclosed-widget rounded-xl overflow-hidden" 
                data-url="https://app.iclosed.io/e/divineacquisitionn/homeservice" 
                title="Free Retention Audit" 
                style={{ width: '100%', height: '620px' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center md:items-start gap-2">
              <Link href="/free-audit">
                <Image 
                  src="/logo.png" 
                  alt="Divine Acquisition" 
                  width={140} 
                  height={140}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                />
              </Link>
              <span className="text-neutral-500 text-xs">Retention systems for SaaS</span>
            </div>
            <div className="flex items-center gap-5">
              <a href="https://x.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Twitter
              </a>
              <a href="mailto:hello@divineacquisition.com" className="text-sm text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Contact
              </a>
              <a href="https://go.divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-sm text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Privacy Policy
              </a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <span className="text-neutral-500 text-xs">
              © 2026 Divine Acquisition. All rights reserved.
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
