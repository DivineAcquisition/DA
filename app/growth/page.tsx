'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';

function GlowDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75 animate-ping" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5500FF] shadow-[0_0_10px_3px_rgba(85,0,255,0.6)]" />
    </span>
  );
}

const includedCards = [
  {
    number: '01',
    title: 'Custom Reactivation Campaigns',
    description: 'Built around your actual customer database. We segment by dormancy period and create personalized multi-touch sequences — not generic blasts.',
  },
  {
    number: '02',
    title: 'AI Voicemail Drops',
    description: 'Your past customers get a voicemail that sounds like a real person calling from your company. "Hey Sarah, it\'s been a while since your last deep clean..." — without you dialing a single number.',
  },
  {
    number: '03',
    title: 'Multi-Channel Sequences',
    description: 'SMS, email, and voicemail working together. Three touchpoints, three chances to bring each customer back. Timed and sequenced for maximum response.',
  },
  {
    number: '04',
    title: 'Custom Booking Pages',
    description: 'Branded pages with dynamic pricing, service selection, and integrated payment. Your customers go from reactivation message to paid booking in 2 minutes.',
  },
];

const highlightCard = {
  number: '05',
  title: 'Ongoing Campaign Management & Optimization',
  description: 'We don\'t set it and forget it. We monitor performance, adjust messaging, run seasonal campaigns, and optimize continuously. Monthly reporting shows exactly what was recovered and what\'s next.',
};

const timelinePhases = [
  {
    phase: 'Phase 1',
    months: 'Month 1-2',
    description: 'Reactivation. We import your data, segment your dormant customers, build your booking page, and launch your first campaigns. This is where the fastest revenue recovery happens.',
  },
  {
    phase: 'Phase 2',
    months: 'Month 3-4',
    description: 'Retention. Post-service follow-ups, automated review requests, rebooking nudges, and membership or subscription program buildout. We stop the leak so customers stop disappearing.',
  },
  {
    phase: 'Phase 3',
    months: 'Month 5-6',
    description: 'Expansion. Referral systems, upsell automation, seasonal campaigns, and price optimization. We increase what every customer is worth to your business.',
  },
];

const pricingFeatures = [
  { bold: 'Custom reactivation campaigns', text: 'built on your data, not templates' },
  { bold: 'AI voicemail drops', text: 'personal-sounding messages at scale' },
  { bold: 'Multi-channel sequences', text: 'SMS + email + voicemail working together' },
  { bold: 'Custom booking pages', text: 'branded with dynamic pricing and payment' },
  { bold: 'Ongoing campaign management', text: 'we optimize monthly, not set and forget' },
  { bold: '6-month phased buildout', text: 'reactivation → retention → expansion' },
];

export default function GrowthPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
          className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-full md:w-[1400px] h-[900px] md:h-[1100px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(98,0,255,0.5) 0%, rgba(98,0,255,0.25) 30%, rgba(144,125,255,0.1) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute bottom-[-15%] right-[-5%] w-[700px] h-[700px] rounded-full opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.5) 0%, rgba(98,0,255,0.2) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        <div 
          className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.4) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-white/5 bg-[#0a0a0a]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/growth" className="group">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={180} 
              height={180}
              className="group-hover:opacity-80 transition-opacity"
            />
          </Link>
          
          <a
            href="#book"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.5)]"
          >
            Book Growth Audit
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 pt-36 pb-16 md:pt-48 md:pb-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div 
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
                        text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/40 mb-8
                        shadow-[0_0_40px_-5px_rgba(144,125,255,0.6)]
                        ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Done-For-You Growth System
          </div>

          {/* Headline */}
          <h1 
            className={`text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-6 leading-[1.15] text-transparent bg-clip-text
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 30%, #907DFF 60%, #5500FF 100%)',
            }}
          >
            We Build and Run Your Entire Retention Engine
          </h1>

          {/* Sub */}
          <p 
            className={`text-lg md:text-xl text-neutral-400 leading-relaxed font-light max-w-2xl mx-auto mb-10
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            Custom reactivation campaigns, AI voicemail drops, advanced segmentation, and hands-on management. You don&apos;t touch anything. You just watch the bookings come in.
          </p>

          {/* CTA */}
          <a
            href="#book"
            className={`inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-base font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.5)] hover:shadow-[0_0_50px_rgba(85,0,255,0.6)] hover:-translate-y-0.5
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            Book Your Free Growth Audit
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <p 
            className={`mt-4 text-xs text-neutral-500 font-light
                        ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}
          >
            15 minutes. No pitch. Just math showing what&apos;s recoverable.
          </p>
        </div>
      </section>

      {/* VSL Section */}
      <section className="relative z-10 border-t border-b border-white/5 bg-[#0a0a0a]/50 py-20 md:py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <GlowDot />
            <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
              Watch First
            </span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 30%, #907DFF 65%, #5500FF 100%)',
            }}
          >
            See how cleaning companies are recovering $3,000-9,000/month
          </h2>
          <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-2xl mx-auto mb-12">
            9-minute breakdown of the system, the results, and exactly what we do for you.
          </p>

          <div className="relative rounded-2xl bg-[#111111] border border-white/10 p-2 overflow-hidden shadow-[0_0_50px_rgba(85,0,255,0.1)]">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#5500FF]/30 via-transparent to-[#907DFF]/30 pointer-events-none" style={{ padding: '1px' }} />
            <div className="relative rounded-xl overflow-hidden bg-black">
              <div
                style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}
              >
                <iframe
                  src="https://fast.wistia.net/embed/iframe/39m0mb8bqn?seo=true&videoFoam=false"
                  title="Growth Plan VSL"
                  allow="autoplay; fullscreen"
                  frameBorder="0"
                  scrolling="no"
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ border: 0 }}
                />
              </div>
            </div>
          </div>

          <p className="mt-5 text-xs text-neutral-500 font-light italic">
            Watch before your call so we can jump straight into your numbers
          </p>
        </div>
      </section>

      {/* What's Included Section */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <GlowDot />
            <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
              What&apos;s Included
            </span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 35%, #907DFF 65%, #5500FF 100%)',
            }}
          >
            Everything built, launched, and managed for you
          </h2>
          <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-xl mb-14">
            We don&apos;t hand you templates and wish you luck. We build the entire system on your data and run it month over month.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {includedCards.map((card) => (
              <div 
                key={card.number}
                className="group p-7 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#907DFF]/50 hover:shadow-[0_0_30px_rgba(144,125,255,0.15)] transition-all duration-300"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#5500FF]/15 text-[#907DFF] text-xs font-bold mb-4 shadow-[0_0_15px_rgba(85,0,255,0.3)]">
                  {card.number}
                </span>
                <h3 className="text-lg font-semibold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-neutral-400 font-light leading-relaxed">{card.description}</p>
              </div>
            ))}

            {/* Highlight card spanning full width */}
            <div className="md:col-span-2 group p-7 rounded-2xl bg-gradient-to-br from-[#5500FF]/10 to-[#111111] border border-[#907DFF]/30 hover:border-[#907DFF]/50 hover:shadow-[0_0_40px_rgba(85,0,255,0.2)] transition-all duration-300">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#5500FF]/15 text-[#907DFF] text-xs font-bold mb-4 shadow-[0_0_15px_rgba(85,0,255,0.3)]">
                {highlightCard.number}
              </span>
              <h3 className="text-lg font-semibold text-white mb-2">{highlightCard.title}</h3>
              <p className="text-sm text-neutral-400 font-light leading-relaxed">{highlightCard.description}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="relative z-10 border-t border-b border-white/5 bg-[#0a0a0a]/50 py-20 md:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <GlowDot />
            <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
              The 6-Month Buildout
            </span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 40%, #907DFF 70%, #5500FF 100%)',
            }}
          >
            Phased approach. Results from month one.
          </h2>
          <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-xl mb-14">
            We don&apos;t dump everything on you at once. Each phase builds on proven results from the one before.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {timelinePhases.map((phase) => (
              <div 
                key={phase.phase}
                className="group relative p-7 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#907DFF]/50 hover:shadow-[0_0_30px_rgba(144,125,255,0.15)] transition-all duration-300 overflow-hidden"
              >
                {/* Top gradient line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#5500FF] to-transparent" />
                <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.15em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
                  {phase.phase}
                </span>
                <h3 className="text-2xl font-semibold text-white mt-2 mb-4">{phase.months}</h3>
                <p className="text-sm text-neutral-400 font-light leading-relaxed">{phase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <GlowDot />
            <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
              Investment
            </span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 40%, #907DFF 70%, #5500FF 100%)',
            }}
          >
            Built to pay for itself in weeks, not months
          </h2>
          <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-xl mx-auto mb-14">
            Bring back 3-4 past customers and the entire system has covered its cost. Most clients see that in the first two weeks.
          </p>

          {/* Pricing Card */}
          <div className="max-w-lg mx-auto rounded-2xl bg-[#111111] border border-[#907DFF]/30 overflow-hidden shadow-[0_0_50px_rgba(85,0,255,0.15)]">
            {/* Top gradient line */}
            <div className="h-[2px] bg-gradient-to-r from-[#5500FF] via-[#907DFF] to-[#5500FF]" />
            
            {/* Header */}
            <div className="p-8 md:p-10 text-center border-b border-white/5">
              <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)] mb-4 block">
                Growth Plan
              </span>
              <div className="text-6xl md:text-7xl font-bold text-white tracking-tight">
                $497<span className="text-xl text-neutral-500 font-normal">/month</span>
              </div>
              <p className="mt-3 text-sm text-neutral-400 font-light">
                + <strong className="text-[#907DFF] font-medium">$500</strong> one-time setup fee
              </p>
            </div>

            {/* Features */}
            <div className="p-6 md:p-8 text-left">
              {pricingFeatures.map((feature) => (
                <div key={feature.bold} className="flex items-start gap-4 py-3 border-b border-white/5 last:border-b-0">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#5500FF]/20 border border-[#907DFF] flex items-center justify-center mt-0.5">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#907DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="text-sm text-neutral-400 font-light leading-relaxed">
                    <strong className="text-white font-medium">{feature.bold}</strong> — {feature.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Action */}
            <div className="p-6 md:p-8 pt-2 border-t border-white/5">
              <p className="text-sm text-neutral-500 font-light text-center leading-relaxed">
                Book a free 15-minute growth audit below. We&apos;ll look at your numbers, show you what&apos;s recoverable, and decide together if it makes sense.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Calendar / Booking Section */}
      <section className="relative z-10 border-t border-white/5 bg-[#0a0a0a]/50 py-20 md:py-28 px-6" id="book">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <GlowDot />
            <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
              Book Your Growth Audit
            </span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 75%, #5500FF 100%)',
            }}
          >
            15 minutes. Just math.
          </h2>
          <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-2xl mx-auto mb-12">
            Pick a time below. Before our call, watch the video above so we can skip the basics and jump straight into your specific numbers.
          </p>

          <div className="rounded-2xl bg-[#111111] border border-white/10 p-4 md:p-8 overflow-hidden shadow-[0_0_50px_rgba(85,0,255,0.1)]">
            {/* iClosed inline widget */}
            <div 
              className="iclosed-widget" 
              data-url="https://app.iclosed.io/e/vistrial/growth-audit" 
              title="Growth Audit" 
              style={{ width: '100%', height: '620px' }}
            />
            <Script 
              src="https://app.iclosed.io/assets/widget.js"
              strategy="lazyOnload"
            />
          </div>

          <p className="mt-5 text-xs text-neutral-500 font-light italic">
            No pitch. We look at your numbers and tell you exactly how many past customers are recoverable.
          </p>
        </div>
      </section>

      {/* Starter Banner */}
      <section className="relative z-10 border-t border-b border-white/5 py-16 md:py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 
            className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 40%, #907DFF 70%, #5500FF 100%)',
            }}
          >
            Not ready for done-for-you? Try our Starter Plan
          </h2>
          <p className="text-base text-neutral-400 font-light leading-relaxed mb-8">
            Get pre-built sales and retention workflows plus a custom booking page for $197/month. No setup fee. Plug in your data and go live today.
          </p>
          <Link
            href="/starter"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-[#907DFF] border border-[#907DFF]/40 hover:bg-[#907DFF]/10 hover:border-[#907DFF] hover:shadow-[0_0_25px_rgba(144,125,255,0.3)] transition-all"
          >
            See Starter Plan — $197/mo
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Link href="/growth">
                <Image 
                  src="/6 (0-00-00-00)_1.png" 
                  alt="Divine Acquisition" 
                  width={32} 
                  height={32}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                />
              </Link>
              <span className="text-neutral-500 text-xs font-medium">
                2026 &copy; DivineAcquisition&trade;, All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-5">
              <a href="https://instagram.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Instagram
              </a>
              <a href="https://x.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Twitter
              </a>
              <a href="https://divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
