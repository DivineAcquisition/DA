'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const prepareItems = [
  { icon: "📊", text: "Your approximate monthly lead volume" },
  { icon: "📈", text: "Your current close rate (estimate is fine)" },
  { icon: "💰", text: "What % of customers are recurring vs one-time" },
  { icon: "🎯", text: "Your biggest bottleneck right now" },
];

const coverItems = [
  "Where your leads are leaking (and how much it's costing)",
  "The 3-phase system customized for your business",
  "Realistic timeline and projections",
  "Investment options and next steps",
];

export default function BookedPage() {
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
          className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-full md:w-[1400px] h-[800px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.25) 0%, rgba(144,125,255,0.1) 40%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute bottom-[20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30"
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
        </div>
      </nav>

      {/* Important Banner */}
      <div className={`fixed top-20 left-0 right-0 z-40 bg-amber-500/10 border-b border-amber-500/30 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
        <div className="max-w-7xl mx-auto px-6 py-3">
          <p className="text-center text-sm text-amber-300 font-medium">
            <span className="mr-2">⚠️</span>
            IMPORTANT: Please Make Sure You&apos;ve Watched Our Training Assets Or Content Before Attending Your Call
          </p>
        </div>
      </div>

      {/* Main Content */}
      <section className="relative z-10 px-6 pt-44 pb-20 md:pt-52 md:pb-28">
        <div className="max-w-4xl mx-auto">
          {/* Success Icon */}
          <div 
            className={`flex justify-center mb-8 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.3)]">
              <span className="text-4xl">✅</span>
            </div>
          </div>

          {/* Headline */}
          <h1 
            className={`text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-6 leading-[1.1] text-center text-transparent bg-clip-text
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #22c55e 100%)',
            }}
          >
            You&apos;re Booked — Here&apos;s What Happens Next
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-lg md:text-xl text-neutral-400 leading-relaxed font-light text-center max-w-xl mx-auto mb-12
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            Your strategy call is confirmed. Check your email for the details.
          </p>

          {/* Video Section */}
          <div 
            className={`relative p-8 md:p-10 rounded-2xl bg-[#111111]/80 border border-[#907DFF]/30 shadow-[0_0_60px_rgba(144,125,255,0.1)] mb-8
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
              <span>📺</span> Watch This Before Your Call
            </h2>
            {/* Video embed placeholder */}
            <div className="bg-[#0a0a0a] rounded-xl border border-white/5 aspect-video flex items-center justify-center">
              <p className="text-neutral-500">Video embed loads here</p>
            </div>
          </div>

          {/* Bonus Section */}
          <div 
            className={`relative p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[#5500FF]/10 to-[#907DFF]/10 border border-[#907DFF]/40 shadow-[0_0_40px_rgba(144,125,255,0.15)] mb-8
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">🎁</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Exclusive Bonus</h3>
                <p className="text-neutral-300 font-light">
                  Show up to your call and partner with us — we&apos;ll give you <span className="text-[#907DFF] font-semibold">30 days FREE access</span> to our system!
                </p>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className={`grid md:grid-cols-2 gap-6 mb-8 ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}>
            {/* Come Prepared With */}
            <div className="relative p-6 md:p-8 rounded-2xl bg-[#111111]/80 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <span>📅</span> Your Booking Details
              </h3>
              <p className="text-sm text-neutral-500 mb-6">To make the most of our 45 minutes together, have these ready:</p>
              <ul className="space-y-4">
                {prepareItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-neutral-300 font-light text-sm">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What We'll Cover */}
            <div className="relative p-6 md:p-8 rounded-2xl bg-[#111111]/80 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-6">What We&apos;ll Cover:</h3>
              <ul className="space-y-4">
                {coverItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#907DFF]/20 border border-[#907DFF]/30 flex items-center justify-center mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#907DFF]" />
                    </span>
                    <span className="text-neutral-300 font-light text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Important Notice */}
          <div 
            className={`relative p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20
                        ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <h4 className="text-sm font-semibold text-amber-300 mb-2">Important:</h4>
                <p className="text-neutral-400 font-light text-sm leading-relaxed">
                  Please show up on time. If something comes up, reschedule using the link in your confirmation email at least 24 hours in advance. We keep our calendar tight so we can give you our full attention.
                </p>
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
              <a href="https://hs.divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
