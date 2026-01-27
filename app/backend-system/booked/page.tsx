'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import WistiaPlayer from '@/app/components/WistiaPlayer';

const prepareItems = [
  { icon: "chart", text: "Your approximate monthly lead volume" },
  { icon: "trending", text: "Your current close rate (estimate is fine)" },
  { icon: "dollar", text: "What % of customers are recurring vs one-time" },
  { icon: "target", text: "Your biggest bottleneck right now" },
];

const coverItems = [
  "Where your leads are leaking (and how much it's costing)",
  "The 3-phase system customized for your business",
  "Realistic timeline and projections",
  "Investment options and next steps",
];

const IconComponent = ({ type }: { type: string }) => {
  switch (type) {
    case 'chart':
      return (
        <svg className="w-5 h-5 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      );
    case 'trending':
      return (
        <svg className="w-5 h-5 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      );
    case 'dollar':
      return (
        <svg className="w-5 h-5 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'target':
      return (
        <svg className="w-5 h-5 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
        </svg>
      );
    default:
      return null;
  }
};

export default function BookedPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white antialiased selection:bg-[#5500FF]/50 selection:text-purple-50 overflow-x-hidden">
      
      {/* Wistia Scripts */}
      <Script src="https://fast.wistia.com/player.js" strategy="lazyOnload" />
      <Script src="https://fast.wistia.com/embed/pk21l05fbv.js" strategy="lazyOnload" />
      
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
          <p className="text-center text-sm text-amber-300 font-medium flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
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
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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
              <svg className="w-6 h-6 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Watch This Before Your Call
            </h2>
            {/* Wistia Video Player */}
            <div className="bg-[#0a0a0a] rounded-xl border border-white/5 overflow-hidden">
              <WistiaPlayer mediaId="pk21l05fbv" />
            </div>
          </div>

          {/* Bonus Section */}
          <div 
            className={`relative p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[#5500FF]/10 to-[#907DFF]/10 border border-[#907DFF]/40 shadow-[0_0_40px_rgba(144,125,255,0.15)] mb-8
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#907DFF]/20 border border-[#907DFF]/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
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
                <svg className="w-5 h-5 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                Your Booking Details
              </h3>
              <p className="text-sm text-neutral-500 mb-6">To make the most of our 45 minutes together, have these ready:</p>
              <ul className="space-y-4">
                {prepareItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <IconComponent type={item.icon} />
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
              <svg className="w-6 h-6 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
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
