'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';

const callBenefits = [
  "Look at your current lead flow and where you're losing revenue",
  "Map out the 3-phase system for your specific business",
  "Show you realistic projections for the next 90 days",
  "Answer any questions you have"
];

export default function ThankYouPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white antialiased selection:bg-[#5500FF]/50 selection:text-purple-50 overflow-x-hidden">
      
      {/* iClosed Script */}
      <Script 
        src="https://app.iclosed.io/assets/widget.js" 
        strategy="lazyOnload"
      />

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
          className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-full md:w-[1400px] h-[900px] md:h-[1000px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.3) 0%, rgba(34,197,94,0.1) 30%, rgba(144,125,255,0.05) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.4) 0%, transparent 60%)',
            filter: 'blur(80px)',
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
        <div className="max-w-3xl mx-auto">
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
            You&apos;re In — Now Book Your Strategy Call
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-lg md:text-xl text-neutral-400 leading-relaxed font-light text-center max-w-xl mx-auto mb-12
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            We got your application. Next step: pick a time to talk.
          </p>

          {/* What We'll Cover Card */}
          <div 
            className={`relative p-8 md:p-10 rounded-2xl bg-[#111111]/80 border border-white/10 mb-10
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            <h2 className="text-xl font-semibold text-white mb-6">On this call, we&apos;ll:</h2>
            <ul className="space-y-4">
              {callBenefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mt-0.5">
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-neutral-300 font-light">{benefit}</span>
                </li>
              ))}
            </ul>
            
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-neutral-400 font-light italic">
                This isn&apos;t a generic sales pitch. We&apos;ll get into the specifics of <span className="text-white font-medium">YOUR</span> business.
              </p>
            </div>
          </div>

          {/* Calendar Embed */}
          <div 
            className={`relative p-8 md:p-10 rounded-2xl bg-[#111111]/80 border border-[#907DFF]/30 shadow-[0_0_60px_rgba(144,125,255,0.1)]
                        ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}
          >
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold text-white">Select a Time That Works For You</h3>
            </div>
            {/* iClosed Calendar Widget */}
            <div 
              className="iclosed-widget rounded-xl overflow-hidden" 
              data-url="https://app.iclosed.io/e/divineacquisitionn/homeservice" 
              title="Backend Conversion System" 
              style={{ width: '100%', height: '620px' }}
            />
          </div>

          {/* Footer Note */}
          <p 
            className={`text-center text-neutral-500 text-sm mt-10 flex items-center justify-center gap-2
                        ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Can&apos;t find a time that works? Email us at{' '}
            <a href="mailto:hello@divineacquisition.com" className="text-[#907DFF] hover:text-white transition-colors">
              hello@divineacquisition.com
            </a>{' '}
            and we&apos;ll figure it out.
          </p>
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
