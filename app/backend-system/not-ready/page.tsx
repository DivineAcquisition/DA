'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const auditFeatures = [
  "5-minute interactive self-assessment",
  "Calculates your exact revenue leakage",
  "Actionable fix recommendations for each issue",
];

export default function NotReadyPage() {
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
          className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-full md:w-[1400px] h-[900px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(144,125,255,0.25) 0%, rgba(98,0,255,0.1) 40%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute bottom-[10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-30"
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
        <div className="max-w-3xl mx-auto">
          {/* Icon */}
          <div 
            className={`flex justify-center mb-8 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#907DFF]/20 to-[#5500FF]/10 border border-[#907DFF]/30 flex items-center justify-center shadow-[0_0_40px_rgba(144,125,255,0.2)]">
              <span className="text-4xl">👋</span>
            </div>
          </div>

          {/* Headline */}
          <h1 
            className={`text-4xl sm:text-5xl md:text-5xl font-semibold tracking-tight mb-6 leading-[1.1] text-center text-transparent bg-clip-text
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
            }}
          >
            No Problem — Sounds Like Timing Isn&apos;t Right
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-lg md:text-xl text-neutral-400 leading-relaxed font-light text-center max-w-xl mx-auto mb-12
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            When you&apos;re ready to fix your backend, we&apos;ll be here.
          </p>

          {/* Explanation Card */}
          <div 
            className={`relative p-8 md:p-10 rounded-2xl bg-[#111111]/80 border border-white/10 mb-10
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            <p className="text-neutral-300 font-light leading-relaxed">
              Building real systems takes commitment, and it sounds like now might not be the right time for that. Totally get it. In the meantime, here&apos;s something that might help:
            </p>
          </div>

          {/* Free Resource Card */}
          <div 
            className={`relative p-8 md:p-10 rounded-2xl bg-gradient-to-br from-[#111111] to-[#0d0d0d] border border-[#907DFF]/40 shadow-[0_0_80px_rgba(144,125,255,0.15)] overflow-hidden
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#5500FF]/15 blur-[80px]" />
            </div>
            
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/30 mb-6">
                <span>🆓</span> Free Tool
              </div>
              
              <h2 className="text-2xl md:text-3xl font-semibold text-white mb-3">
                The Revenue Leakage Audit
              </h2>
              <p className="text-neutral-400 font-light mb-8">
                Find exactly where you&apos;re losing leads and revenue with our interactive 5-minute audit.
              </p>

              <ul className="space-y-4 mb-8">
                {auditFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#907DFF]/20 border border-[#907DFF]/30 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="text-neutral-300 font-light">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/backend-system/leakage-audit"
                className="group inline-flex items-center gap-3 px-8 py-4 rounded-full text-base font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_40px_rgba(85,0,255,0.5)] hover:shadow-[0_0_60px_rgba(85,0,255,0.7)]"
              >
                Take The Free Audit
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Footer Note */}
          <p 
            className={`text-center text-neutral-500 text-sm mt-10
                        ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}
          >
            No email required. Get instant results and actionable insights.
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
              <a href="https://hiring.divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
