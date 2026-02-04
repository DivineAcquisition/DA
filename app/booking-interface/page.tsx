'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// Glowing dot component
function GlowDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75 animate-ping" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5500FF] shadow-[0_0_10px_3px_rgba(85,0,255,0.6)]" />
    </span>
  );
}

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: 'Smart Calendar Sync',
    description: 'Automatically sync with Google Calendar, iCal, and Outlook. Never double-book or miss an appointment again.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    title: 'Automated Reminders',
    description: 'SMS and email reminders reduce no-shows by 80%. Keep your schedule full and your revenue growing.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    title: 'Instant Deposits',
    description: 'Collect deposits at booking to eliminate last-minute cancellations. Protect your time and revenue.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
    title: 'Real-Time Analytics',
    description: 'Track bookings, revenue, and customer behavior. Make data-driven decisions to grow your business.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Brand Customization',
    description: 'Match your brand colors, logo, and messaging. Create a seamless customer experience.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    title: 'Mobile Optimized',
    description: 'Your customers book from their phones. Our interface is designed mobile-first for the highest conversion.',
  },
];

const painPoints = [
  'Spending hours on the phone scheduling appointments',
  'Losing customers to competitors with online booking',
  'No-shows and last-minute cancellations eating into profits',
  'Double-bookings causing chaos and angry customers',
  'No way to collect deposits upfront',
  'Manual reminder calls wasting your valuable time',
];

const testimonials = [
  {
    quote: "Our bookings increased 40% in the first month. The automated reminders alone saved us 10+ hours a week.",
    name: "Sarah Mitchell",
    company: "Sparkle Clean Co.",
    metric: "40% more bookings"
  },
  {
    quote: "We went from 25% no-show rate to less than 5%. The deposit feature changed everything for us.",
    name: "Marcus Johnson",
    company: "Elite Cleaning Services",
    metric: "80% fewer no-shows"
  },
  {
    quote: "Setup was incredibly easy. Within a week, we had a professional booking system that makes us look like a major company.",
    name: "Jennifer Lopez",
    company: "Fresh Start Maids",
    metric: "Live in 7 days"
  },
];

export default function BookingInterfacePage() {
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
          <Link href="/" className="group">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={180} 
              height={180}
              className="group-hover:opacity-80 transition-opacity"
            />
          </Link>
          
          <a
            href="#book-call"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.5)]"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            Book Your Demo
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-32 pb-8 md:pt-40 md:pb-12">
        <div className="max-w-5xl mx-auto text-center">
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
            For Cleaning Companies Only
          </div>

          {/* Headline */}
          <h1 
            className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 leading-[1.1] text-transparent bg-clip-text
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 40%, #907DFF 70%, #5500FF 100%)',
            }}
          >
            Stop Losing Bookings To Your Competition
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-xl md:text-2xl text-neutral-400 leading-relaxed font-light max-w-3xl mx-auto mb-10
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            Get a custom booking interface that converts website visitors into paying customers — 
            <span className="text-white font-medium"> automatically</span>.
          </p>

          {/* CTA Button */}
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}>
            <a
              href="#book-call"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-lg font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_40px_rgba(85,0,255,0.6)] hover:shadow-[0_0_50px_rgba(85,0,255,0.8)]"
            >
              Watch The Demo
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </a>
          </div>

          {/* Trust Badge */}
          <p className={`text-sm text-neutral-500 ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}>
            Trusted by 50+ cleaning companies across the United States
          </p>
        </div>
      </section>

      {/* VSL Section */}
      <section className="relative z-10 px-6 py-12 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden bg-[#111111] border border-white/10 shadow-[0_0_60px_rgba(85,0,255,0.2)]">
            {/* Mac-style title bar */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-white/10 bg-[#0d0d0d]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-[0_0_8px_rgba(255,95,86,0.5)]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-[0_0_8px_rgba(255,189,46,0.5)]" />
                <span className="w-3 h-3 rounded-full bg-[#27C93F] shadow-[0_0_8px_rgba(39,201,63,0.5)]" />
              </div>
              <div className="flex items-center gap-2 text-neutral-400 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Watch how it works
              </div>
            </div>
            
            {/* Video Embed */}
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe 
                src="https://www.loom.com/embed/83eefbba6a9d410799d4bac598934113" 
                frameBorder="0" 
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">The Problem</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              Sound Familiar?
            </h2>
            <p className="text-neutral-400 font-light text-lg">
              Most cleaning companies are losing money every single day because of these problems:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {painPoints.map((point, index) => (
              <div 
                key={index}
                className="flex items-start gap-4 p-5 rounded-xl bg-[#111111] border border-white/5 hover:border-red-500/20 transition-all group"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-neutral-300 font-light leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">The Solution</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              Your Custom Booking Interface
            </h2>
            <p className="text-neutral-400 font-light text-lg max-w-2xl mx-auto">
              Everything you need to automate your booking process and grow your cleaning business.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#907DFF]/50 hover:shadow-[0_0_30px_rgba(144,125,255,0.15)] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-[#5500FF]/15 flex items-center justify-center text-[#907DFF] mb-5 group-hover:bg-[#5500FF]/25 group-hover:shadow-[0_0_20px_rgba(85,0,255,0.4)] transition-all">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#907DFF] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-neutral-400 font-light leading-relaxed text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">Results</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              Trusted by Cleaning Companies
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index}
                className="p-6 rounded-2xl bg-gradient-to-br from-[#5500FF]/10 to-transparent border border-[#5500FF]/20 shadow-[0_0_30px_rgba(85,0,255,0.1)]"
              >
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#5500FF]/20 text-[#907DFF]">
                    {testimonial.metric}
                  </span>
                </div>
                <p className="text-neutral-300 font-light leading-relaxed mb-6 text-sm">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div>
                  <p className="text-white font-medium">{testimonial.name}</p>
                  <p className="text-neutral-500 text-sm">{testimonial.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's Included Section */}
      <section className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">What You Get</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              Everything Included
            </h2>
          </div>

          <div className="p-8 rounded-2xl bg-[#111111] border border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                'Custom branded booking page',
                'Mobile-optimized design',
                'Google Calendar integration',
                'Automated SMS reminders',
                'Automated email reminders',
                'Deposit collection system',
                'Service selection menu',
                'Real-time availability',
                'Customer database',
                'Analytics dashboard',
                'Unlimited bookings',
                'Priority support',
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5500FF]/20 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-neutral-300 font-light">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Calendar Booking Section */}
      <section id="book-call" className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">Next Step</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              Book Your Demo Call
            </h2>
            <p className="text-neutral-400 font-light text-lg max-w-2xl mx-auto">
              See exactly how the booking interface will work for your cleaning company. 
              We&apos;ll walk you through the setup process and answer all your questions.
            </p>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-[#111111] border border-white/10 shadow-[0_0_60px_rgba(85,0,255,0.2)]">
            {/* Mac-style title bar */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-white/10 bg-[#0d0d0d]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-[0_0_8px_rgba(255,95,86,0.5)]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-[0_0_8px_rgba(255,189,46,0.5)]" />
                <span className="w-3 h-3 rounded-full bg-[#27C93F] shadow-[0_0_8px_rgba(39,201,63,0.5)]" />
              </div>
              <div className="flex items-center gap-2 text-neutral-400 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Select a time that works for you
              </div>
            </div>
            
            {/* Calendar Embed */}
            <iframe 
              src="https://api.leadconnectorhq.com/widget/booking/sXa1BwNUHVmAbLfaJDDC" 
              style={{ width: '100%', border: 'none', overflow: 'hidden', minHeight: '700px' }}
              scrolling="no" 
              id="sXa1BwNUHVmAbLfaJDDC_1738624800000"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">FAQ</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              Common Questions
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "How long does it take to set up?",
                a: "Most cleaning companies are up and running within 7 days. We handle all the technical setup — you just provide your branding and service details."
              },
              {
                q: "Do I need any technical skills?",
                a: "Not at all. We build everything for you and provide training on how to manage your bookings. If you can use Facebook, you can use this."
              },
              {
                q: "Will this work with my existing website?",
                a: "Yes! We can embed the booking widget on your existing website, or provide you with a standalone booking page if you prefer."
              },
              {
                q: "What if my customers don't book online?",
                a: "You can still manually add bookings for customers who call. But you'll be surprised — once you offer online booking, most customers prefer it."
              },
              {
                q: "Is there a contract or commitment?",
                a: "No long-term contracts. We're confident you'll love the results, so we don't lock you in."
              },
            ].map((faq, index) => (
              <div 
                key={index}
                className="p-6 rounded-xl bg-[#111111] border border-white/10"
              >
                <h3 className="text-white font-medium mb-2">{faq.q}</h3>
                <p className="text-neutral-400 font-light text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-6">
            Ready to Automate Your Bookings?
          </h2>
          <p className="text-neutral-400 font-light text-lg mb-8">
            Join the cleaning companies that are growing faster with automated booking.
          </p>
          <a
            href="#book-call"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-lg font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_40px_rgba(85,0,255,0.6)] hover:shadow-[0_0_50px_rgba(85,0,255,0.8)]"
          >
            Book Your Demo Call
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Link href="/">
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
