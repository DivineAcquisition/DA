'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import WistiaPlayer from '@/app/components/WistiaPlayer';

const painPoints = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
    title: "Leads Going to Voicemail",
    description: "While you're on a job, potential customers are leaving voicemails that never get returned in time."
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Competitors Stealing Work",
    description: "Other contractors are winning jobs simply because they responded faster — not because they're better."
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Wasted Ad Spend",
    description: "Money spent on ads is going down the drain because follow-up was too slow to convert the lead."
  }
];

const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
    title: "Lead Generation",
    subtitle: "FB & Google Ads",
    description: "Targeted campaigns that bring in qualified leads from homeowners actively searching for your services."
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    title: "AI-Powered Instant Response",
    subtitle: "Under 60 Seconds",
    description: "Our AI calls your leads within 60 seconds of submission — before they even think about calling someone else."
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    title: "Automated Follow-Up",
    subtitle: "Until They Book",
    description: "Persistent, professional follow-up sequences that nurture leads until they're ready to schedule."
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
    title: "Review Requests",
    subtitle: "After Every Job",
    description: "Automated review requests that build your online reputation and bring in more organic leads."
  }
];

const stats = [
  { value: "60", unit: "sec", label: "Average Response Time" },
  { value: "3x", unit: "", label: "More Jobs Closed" },
  { value: "24/7", unit: "", label: "Lead Coverage" },
];

export default function HomeServicesPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white antialiased selection:bg-[#5500FF]/50 selection:text-purple-50 overflow-x-hidden">
      
      {/* Wistia Scripts */}
      <Script src="https://fast.wistia.com/player.js" strategy="lazyOnload" />
      <Script src="https://fast.wistia.com/embed/o2tstyl6cj.js" strategy="lazyOnload" />
      
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
        {/* Main hero glow */}
        <div 
          className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-full md:w-[1600px] h-[1000px] md:h-[1200px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(98,0,255,0.45) 0%, rgba(98,0,255,0.2) 30%, rgba(144,125,255,0.08) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Bottom left glow - for form section */}
        <div 
          className="absolute bottom-[-10%] left-[-10%] w-[800px] h-[800px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.5) 0%, rgba(98,0,255,0.2) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Right side glow */}
        <div 
          className="absolute top-[50%] right-[-5%] w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.4) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Features section glow */}
        <div 
          className="absolute top-[60%] left-[20%] w-[500px] h-[500px] rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, rgba(85,0,255,0.4) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-white/5 bg-[#0a0a0a]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/home-services" className="group">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.5)] hover:shadow-[0_0_40px_rgba(85,0,255,0.7)]"
          >
            Book a Call
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-32 pb-12 md:pt-40 md:pb-16">
        <div className="max-w-4xl mx-auto text-center">
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
            For Home Service Contractors
          </div>

          {/* Headline */}
          <h1 
            className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 leading-[1.1] text-transparent bg-clip-text
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 40%, #907DFF 70%, #5500FF 100%)',
            }}
          >
            Stop Losing Jobs to the Contractor Who Called Back First
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-lg md:text-xl text-neutral-400 leading-relaxed font-light max-w-2xl mx-auto mb-10
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            We get you leads and call them in under 60 seconds — so you close more jobs without hiring more staff.
          </p>

          {/* CTA Buttons */}
          <div 
            className={`flex flex-col sm:flex-row items-center justify-center gap-4
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            <a
              href="#book-call"
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-full text-base font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_40px_rgba(85,0,255,0.5)] hover:shadow-[0_0_60px_rgba(85,0,255,0.7)]"
            >
              See How It Works — Book a 15-Min Call
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>

          {/* Stats */}
          <div 
            className={`flex flex-wrap justify-center gap-8 md:gap-16 mt-16
                        ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text" style={{
                    backgroundImage: 'linear-gradient(135deg, white 0%, #907DFF 100%)',
                  }}>
                    {stat.value}
                  </span>
                  {stat.unit && (
                    <span className="text-lg md:text-xl text-[#907DFF] font-medium">{stat.unit}</span>
                  )}
                </div>
                <p className="text-sm text-neutral-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="relative z-10 px-6 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div 
            className={`relative p-6 md:p-8 rounded-2xl bg-[#111111]/80 border border-[#907DFF]/30 shadow-[0_0_60px_rgba(144,125,255,0.1)]
                        ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}
          >
            <h2 className="text-xl font-semibold text-white mb-6 text-center flex items-center justify-center gap-3">
              <svg className="w-6 h-6 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              See How We Fix Revenue Leaks
            </h2>
            {/* Wistia Video Player */}
            <div className="rounded-xl overflow-hidden">
              <WistiaPlayer mediaId="o2tstyl6cj" />
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="relative z-10 px-6 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className={`text-center mb-16 ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, #907DFF 100%)',
            }}>
              Sound Familiar?
            </h2>
            <p className="text-neutral-400 font-light max-w-xl mx-auto">
              These problems are costing you thousands every month
            </p>
          </div>

          <div className={`grid md:grid-cols-3 gap-6 ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}>
            {painPoints.map((point, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-2xl bg-[#111111]/80 border border-white/10 hover:border-red-500/30 hover:shadow-[0_0_40px_rgba(239,68,68,0.15)] transition-all duration-300 overflow-hidden"
              >
                {/* Subtle red glow on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-red-500/10 blur-[50px]" />
                </div>
                
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-5">
                    {point.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{point.title}</h3>
                  <p className="text-neutral-400 font-light leading-relaxed">{point.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features/What They Get Section */}
      <section className="relative z-10 px-6 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className={`text-center mb-16 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-6">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              The Solution
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
              backgroundImage: 'linear-gradient(to right, white 0%, #907DFF 100%)',
            }}>
              What You Get
            </h2>
            <p className="text-neutral-400 font-light max-w-xl mx-auto">
              Everything you need to capture and convert more leads
            </p>
          </div>

          <div className={`grid md:grid-cols-2 gap-6 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative p-8 rounded-2xl bg-[#111111]/80 border border-white/10 hover:border-[#907DFF]/50 hover:shadow-[0_0_40px_rgba(144,125,255,0.2),inset_0_0_30px_rgba(144,125,255,0.03)] transition-all duration-300 overflow-hidden"
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-[#907DFF]/15 blur-[60px]" />
                </div>
                
                <div className="relative">
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#5500FF]/20 to-[#907DFF]/10 border border-[#907DFF]/30 flex items-center justify-center text-[#907DFF] flex-shrink-0 shadow-[0_0_20px_rgba(144,125,255,0.2)]">
                      {feature.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-white group-hover:text-[#907DFF] transition-colors">{feature.title}</h3>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#907DFF]/15 text-[#907DFF] shadow-[0_0_10px_rgba(144,125,255,0.3)]">
                          {feature.subtitle}
                        </span>
                      </div>
                      <p className="text-neutral-400 font-light leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA / Calendar Section */}
      <section className="relative z-10 px-6 py-20 md:py-28" id="book-call">
        <div className="max-w-4xl mx-auto">
          <div className={`relative p-8 md:p-12 rounded-3xl bg-[#111111]/90 border border-[#907DFF]/30 shadow-[0_0_80px_rgba(144,125,255,0.15)] overflow-hidden ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#5500FF]/20 blur-[100px]" />
            </div>
            
            <div className="relative">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/40 mb-6 shadow-[0_0_30px_rgba(144,125,255,0.3)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#907DFF]" />
                  </span>
                  Limited Spots Available
                </div>
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-transparent bg-clip-text" style={{
                  backgroundImage: 'linear-gradient(to right, white 0%, white 50%, #907DFF 100%)',
                }}>
                  See How It Works
                </h2>
                <p className="text-neutral-400 font-light max-w-lg mx-auto">
                  Book a free 15-minute call and we&apos;ll show you exactly how we can help you close more jobs.
                </p>
              </div>

              {/* iClosed Calendar Widget */}
              <div 
                className="iclosed-widget rounded-xl overflow-hidden" 
                data-url="https://app.iclosed.io/e/divineacquisitionn/homeservice" 
                title="Backend Conversion System" 
                style={{ width: '100%', height: '620px' }}
              />

              <p className="text-center text-xs text-neutral-500 mt-6">
                No obligation. No credit card required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Link href="/home-services">
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
