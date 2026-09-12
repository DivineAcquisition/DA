'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

function GlowDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75 animate-ping" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5500FF] shadow-[0_0_10px_3px_rgba(85,0,255,0.6)]" />
    </span>
  );
}

const problemCards = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: 'Bleeding Past Customers',
    description: 'Customers book once or twice and vanish. No follow-up, no win-back, no system to catch them before they\'re gone for good.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
      </svg>
    ),
    title: 'Dependent on Lead Platforms',
    description: 'You\'re paying Thumbtack and Angi $500-1,500/month for strangers while people who already trust you sit idle in your phone.',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
    title: 'Everything Is Manual',
    description: 'No CRM, no automations, no follow-up sequences. Customer communication lives in scattered texts and your memory.',
  },
];

const features = [
  {
    number: '01',
    title: 'Reactivation Workflows',
    description: 'Pre-built SMS and email sequences that reach out to dormant customers with personalized messages and direct booking links. Just import your list and launch.',
  },
  {
    number: '02',
    title: 'Retention Sequences',
    description: 'Automated post-service follow-ups, review requests, and rebooking nudges timed to your service intervals. Keep customers coming back without lifting a finger.',
  },
  {
    number: '03',
    title: 'Custom Booking Page',
    description: 'Ad-ready booking page with your branding, dynamic pricing matrix, service selection, and integrated payment. Customers go from link to paid booking in 2 minutes.',
  },
  {
    number: '04',
    title: 'Campaign Dashboard',
    description: 'See exactly how many messages were sent, how many customers re-engaged, and how much revenue was recovered. Clear ROI you can track weekly.',
  },
];

const checkoutFeatures = [
  { bold: 'Pre-built reactivation workflows', text: 'SMS and email sequences ready to launch' },
  { bold: 'Retention sequences', text: 'automated follow-ups, review requests, and rebooking nudges' },
  { bold: 'Custom booking page', text: 'branded, ad-ready with dynamic pricing and payment' },
  { bold: 'Campaign dashboard', text: 'track sends, re-engagements, and recovered revenue' },
  { bold: 'Instant access', text: 'import your customer list and go live today' },
];

export default function StarterPage() {
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
          <Link href="/starter" className="group">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={180} 
              height={180}
              className="group-hover:opacity-80 transition-opacity"
            />
          </Link>
          
          <a
            href="#checkout"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.5)]"
          >
            Get Started
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
            <GlowDot />
            Built for residential cleaning companies
          </div>

          {/* Headline */}
          <h1 
            className={`text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-6 leading-[1.15] text-transparent bg-clip-text
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 30%, #907DFF 60%, #5500FF 100%)',
            }}
          >
            Stop Chasing New Leads. Reactivate the Customers You Already Have.
          </h1>

          {/* Sub */}
          <p 
            className={`text-lg md:text-xl text-neutral-400 leading-relaxed font-light max-w-2xl mx-auto mb-14
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            Pre-built sales &amp; retention workflows plus a custom booking page that turns your past customers into recurring revenue. Plug in and go live today.
          </p>

          {/* Stats */}
          <div 
            className={`flex flex-wrap justify-center gap-8 md:gap-16
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            {[
              { value: '60+', label: 'Avg dormant customers' },
              { value: '$9K', label: 'Monthly revenue lost' },
              { value: '15', label: 'Reactivated in month 1' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-semibold text-white tracking-tight">{stat.value}</div>
                <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="relative z-10 border-t border-b border-white/5 bg-[#0a0a0a]/50 py-20 md:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <GlowDot />
            <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
              The Problem
            </span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 45%, #907DFF 80%, #5500FF 100%)',
            }}
          >
            Your past customers aren&apos;t gone. They&apos;re ignored.
          </h2>
          <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-xl mb-14">
            Every month, customers quietly disappear while you spend more trying to replace them.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {problemCards.map((card) => (
              <div 
                key={card.title}
                className="group p-7 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#907DFF]/50 hover:shadow-[0_0_30px_rgba(144,125,255,0.15)] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-[#5500FF]/15 border border-[#5500FF]/30 flex items-center justify-center text-[#907DFF] mb-5 group-hover:shadow-[0_0_20px_rgba(85,0,255,0.4)] transition-all">
                  {card.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-neutral-400 font-light leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <GlowDot />
            <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
              See It In Action
            </span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 40%, #907DFF 70%, #5500FF 100%)',
            }}
          >
            Your custom booking page, ready to convert
          </h2>
          <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-2xl mx-auto mb-12">
            Watch how the booking interface works — dynamic pricing, service selection, and instant payment. This is what your past customers see when they click your reactivation link.
          </p>

          <div className="relative rounded-2xl bg-[#111111] border border-white/10 p-2 overflow-hidden shadow-[0_0_50px_rgba(85,0,255,0.1)]">
            {/* Gradient border effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#5500FF]/30 via-transparent to-[#907DFF]/30 pointer-events-none" style={{ padding: '1px' }} />
            <div className="relative rounded-xl overflow-hidden bg-black">
              <div
                style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}
              >
                <iframe
                  src="https://fast.wistia.net/embed/iframe/rvqzqndh5q?seo=true&videoFoam=false"
                  title="Booking Page Demo"
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
            Custom booking page demo — built specifically for your cleaning company
          </p>
        </div>
      </section>

      {/* What You Get Section */}
      <section className="relative z-10 border-t border-b border-white/5 bg-[#0a0a0a]/50 py-20 md:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
                What You Get
              </span>
            </div>
            <h2 
              className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(to right, white 0%, white 35%, #907DFF 65%, #5500FF 100%)',
              }}
            >
              Plug-and-play workflows that sell and retain
            </h2>
            <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-2xl mx-auto">
              Everything you need to start reactivating past customers and keeping current ones — built and ready to launch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((feature) => (
              <div 
                key={feature.number}
                className="group p-7 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#907DFF]/50 hover:shadow-[0_0_30px_rgba(144,125,255,0.15)] transition-all duration-300"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#5500FF]/15 text-[#907DFF] text-xs font-bold mb-4 shadow-[0_0_15px_rgba(85,0,255,0.3)]">
                  {feature.number}
                </span>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-neutral-400 font-light leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Math Section */}
      <section className="relative z-10 py-20 md:py-28 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <GlowDot />
            <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
              The Math
            </span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-14 text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 40%, #907DFF 70%, #5500FF 100%)',
            }}
          >
            It pays for itself with one rebooking
          </h2>

          <div className="flex flex-col md:flex-row items-center justify-center gap-5 md:gap-6">
            <div className="p-6 md:p-8 rounded-2xl bg-[#111111] border border-white/10 text-center min-w-[160px]">
              <div className="text-3xl md:text-4xl font-semibold text-white tracking-tight">50+</div>
              <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mt-1">Lost Customers</div>
            </div>
            <div className="text-2xl md:text-3xl font-light text-neutral-500">&times;</div>
            <div className="p-6 md:p-8 rounded-2xl bg-[#111111] border border-white/10 text-center min-w-[160px]">
              <div className="text-3xl md:text-4xl font-semibold text-white tracking-tight">$150</div>
              <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mt-1">Avg Booking</div>
            </div>
            <div className="text-2xl md:text-3xl font-light text-neutral-500">=</div>
            <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-[#5500FF]/15 to-[#907DFF]/5 border border-[#907DFF]/40 text-center min-w-[180px] shadow-[0_0_40px_rgba(85,0,255,0.2)]">
              <div className="text-3xl md:text-4xl font-semibold text-[#907DFF] tracking-tight drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">$7,500+</div>
              <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mt-1">Revenue Recoverable</div>
            </div>
          </div>

          <p className="mt-10 text-base text-neutral-400 font-light">
            Your investment: <strong className="text-white font-medium">$197/month</strong>. Bring back just 2 customers and you&apos;re already ahead.
          </p>
        </div>
      </section>

      {/* Checkout Section */}
      <section className="relative z-10 border-t border-white/5 bg-[#0a0a0a]/50 py-20 md:py-28 px-6" id="checkout">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <GlowDot />
            <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)]">
              Get Started Today
            </span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 40%, #907DFF 70%, #5500FF 100%)',
            }}
          >
            Launch your growth system right now
          </h2>
          <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-xl mx-auto mb-14">
            No sales call needed. Pay below and get instant access to your workflows, booking page, and dashboard.
          </p>

          {/* Pricing Card */}
          <div className="max-w-lg mx-auto rounded-2xl bg-[#111111] border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(85,0,255,0.1)]">
            {/* Top gradient line */}
            <div className="h-[2px] bg-gradient-to-r from-[#5500FF] via-[#907DFF] to-[#5500FF]" />
            
            {/* Header */}
            <div className="p-8 md:p-10 text-center border-b border-white/5">
              <span className="text-[10px] font-semibold text-[#907DFF] uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(144,125,255,0.5)] mb-4 block">
                Starter Plan
              </span>
              <div className="text-6xl md:text-7xl font-bold text-white tracking-tight">
                $197<span className="text-xl text-neutral-500 font-normal">/month</span>
              </div>
              <p className="mt-3 text-sm text-neutral-500 font-light">No setup fee. No contracts. Cancel anytime.</p>
            </div>

            {/* Features */}
            <div className="p-6 md:p-8 text-left">
              {checkoutFeatures.map((feature) => (
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
            <div className="p-6 md:p-8 pt-0">
              {/* REPLACE THIS HREF WITH YOUR STRIPE PAYMENT LINK */}
              <a
                href="#"
                className="block w-full py-4 rounded-xl bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white text-center font-semibold hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.5)]"
              >
                Start Now — $197/month &rarr;
              </a>
              <p className="mt-4 text-xs text-neutral-500 font-light text-center flex items-center justify-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Secure payment via Stripe. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Upgrade Banner */}
      <section className="relative z-10 border-t border-b border-white/5 py-16 md:py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 
            className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 30%, #907DFF 70%, #5500FF 100%)',
            }}
          >
            Want us to build and manage everything for you?
          </h2>
          <p className="text-base text-neutral-400 font-light leading-relaxed mb-8">
            Our Growth Plan includes custom reactivation campaigns, AI voicemail drops, advanced segmentation, and hands-on campaign management. We handle your entire retention engine so you just watch the bookings come in.
          </p>
          <Link
            href="/growth"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold text-[#907DFF] border border-[#907DFF]/40 hover:bg-[#907DFF]/10 hover:border-[#907DFF] hover:shadow-[0_0_25px_rgba(144,125,255,0.3)] transition-all"
          >
            Learn About the Growth Plan — $497/mo
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
              <Link href="/starter">
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
