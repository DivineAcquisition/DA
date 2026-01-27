'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const benefits = [
  "Identify where your leads are leaking",
  "Map out a 3-phase recovery system",
  "Get realistic revenue projections",
  "Understand investment options",
];

export default function BookingBCSPage() {
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
          className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-full md:w-[1400px] h-[1000px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(98,0,255,0.35) 0%, rgba(144,125,255,0.15) 40%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.4) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute top-[40%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-30"
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

      {/* Main Content */}
      <section className="relative z-10 px-6 pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Left Column - Info */}
            <div className={mounted ? 'animate-fade-in' : 'opacity-0'}>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/40 mb-6 shadow-[0_0_30px_rgba(144,125,255,0.3)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#907DFF]" />
                </span>
                Backend Conversion System
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6 leading-[1.1] text-transparent bg-clip-text" style={{
                backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
              }}>
                Book Your Strategy Call
              </h1>

              {/* Subheadline */}
              <p className="text-lg text-neutral-400 leading-relaxed font-light mb-10">
                Schedule a time to discuss how the Backend Conversion System can help you recover lost revenue and scale your home service business.
              </p>

              {/* What You'll Get */}
              <div className="relative p-6 rounded-2xl bg-[#111111]/80 border border-white/10 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">On this call, we&apos;ll:</h3>
                <ul className="space-y-3">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#907DFF]/20 border border-[#907DFF]/30 flex items-center justify-center">
                        <svg className="w-3 h-3 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="text-neutral-300 font-light">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-sm text-neutral-400">No obligation</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-neutral-400">45 minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-neutral-400">Video call</span>
                </div>
              </div>
            </div>

            {/* Right Column - Calendar */}
            <div className={`${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
              <div className="relative p-6 md:p-8 rounded-2xl bg-[#111111]/90 border border-[#907DFF]/30 shadow-[0_0_80px_rgba(144,125,255,0.15)] overflow-hidden">
                {/* Background glow */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#5500FF]/15 blur-[80px]" />
                </div>
                
                <div className="relative">
                  <h2 className="text-xl font-semibold text-white mb-6 text-center">Select a Time</h2>
                  
                  {/* Calendar embed placeholder */}
                  <div className="bg-[#0a0a0a] rounded-xl border border-white/5 min-h-[500px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-[#907DFF]/10 border border-[#907DFF]/30 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      </div>
                      <p className="text-neutral-500">Calendar embed loads here</p>
                    </div>
                  </div>
                </div>
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
