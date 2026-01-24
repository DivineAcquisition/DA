'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const jobs = [
  {
    id: 1,
    slug: 'system-integrator',
    title: 'Systems Architect',
    subtitle: 'Infrastructure',
    description: 'Build the machines that make everything work. Turn strategy into pipelines, automations, and integrations using GHL, Zapier, Make, and APIs.',
    department: 'systems',
    location: 'remote',
    level: 3,
  },
  {
    id: 2,
    slug: 'media-buyer',
    title: 'Media Buyer',
    subtitle: 'Growth Architect',
    description: 'Take capital and turn it into qualified conversations. Build philosophy driven campaigns across Meta, Google, and YouTube that compound results.',
    department: 'growth',
    location: 'remote',
    level: 3,
  },
  {
    id: 3,
    slug: 'setter',
    title: 'Setter',
    subtitle: 'Sales Development',
    description: 'Book the right calls with high quality prospects. Identify fit, educate on possibilities, and qualify opportunities for our closers.',
    department: 'sales',
    location: 'remote',
    level: 1,
  },
  {
    id: 4,
    slug: 'closer',
    title: 'Closer',
    subtitle: 'Sales',
    description: 'Convert qualified opportunities into long term partnerships. Guide prospects through decisions and demonstrate how our infrastructure transforms businesses.',
    department: 'sales',
    location: 'remote',
    level: 3,
  },
  {
    id: 5,
    slug: 'client-success',
    title: 'Client Success Manager',
    subtitle: 'Retention',
    description: 'Guardian of transformation. Own the relationship, the experience, and the outcome from onboarding through renewal and beyond.',
    department: 'client-success',
    location: 'remote',
    level: 3,
  },
];

const departments = [
  { id: 'all', name: 'All Roles' },
  { id: 'systems', name: 'Systems' },
  { id: 'growth', name: 'Growth' },
  { id: 'sales', name: 'Sales' },
  { id: 'client-success', name: 'Client Success' },
];

const levelLabels: Record<number, string> = {
  1: 'Entry',
  2: 'Mid',
  3: 'Senior',
  4: 'Lead',
};

function LevelIndicator({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${
              i <= level ? 'bg-[#5500FF] shadow-[0_0_6px_rgba(85,0,255,0.8)]' : 'bg-white/10'
            }`}
          />
        ))}
      </span>
      <span className="text-neutral-500">{levelLabels[level]}</span>
    </span>
  );
}

export default function HiringPage() {
  const [selectedDept, setSelectedDept] = useState('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredJobs = jobs.filter((job) => {
    if (selectedDept !== 'all' && job.department !== selectedDept) return false;
    return true;
  });

  const deptCounts = jobs.reduce((acc, job) => {
    acc[job.department] = (acc[job.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white antialiased selection:bg-[#5500FF]/50 selection:text-purple-50 overflow-x-hidden">
      
      {/* Background Glow Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Large top glow */}
        <div 
          className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] rounded-full opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.4) 0%, rgba(85,0,255,0.2) 40%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Bottom right glow */}
        <div 
          className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(85,0,255,0.5) 0%, rgba(144,125,255,0.2) 50%, transparent 70%)',
            filter: 'blur(120px)',
          }}
        />
        {/* Left side accent */}
        <div 
          className="absolute top-[30%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.3) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Floating Particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {mounted && [...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#907DFF]"
            style={{
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.3 + Math.random() * 0.4,
              animation: `floatParticle ${10 + Math.random() * 20}s linear infinite`,
              animationDelay: `${Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-28 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-2xl">
        <div className="max-w-5xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/hiring" className="group">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={120} 
              height={120}
              className="group-hover:opacity-80 transition-opacity"
            />
          </Link>
          
          <a
            href="https://divineacquisition.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all"
          >
            Visit Website
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-44 pb-20 md:pt-52 md:pb-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div 
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
                        text-[#907DFF] bg-[#5500FF]/10 border border-[#5500FF]/30 mb-8
                        shadow-[0_0_30px_-5px_rgba(85,0,255,0.5)]
                        ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5500FF]" />
            </span>
            We&apos;re Hiring
          </div>

          {/* Headline */}
          <h1 
            className={`text-5xl sm:text-6xl md:text-7xl font-semibold text-white tracking-tight mb-6 leading-[1.05]
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
          >
            Build systems that
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#907DFF] to-[#5500FF]"> compound.</span>
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-xl text-neutral-400 leading-relaxed font-light max-w-2xl mx-auto mb-12
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            B2B growth infrastructure for service based businesses. We build systems that turn 
            one time transactions into long term retained clients.
          </p>

          {/* Values */}
          <div 
            className={`flex flex-wrap justify-center gap-3
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            {['Devotion', 'Value', 'Exclusivity'].map((value) => (
              <span 
                key={value}
                className="px-4 py-2 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-neutral-300"
              >
                {value}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Positions Section */}
      <main className="relative z-10 px-6 pb-20" id="positions">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}>
            <div>
              <h2 className="text-2xl font-semibold text-white tracking-tight">Open Positions</h2>
              <p className="text-neutral-500 text-sm mt-1">{jobs.length} roles available</p>
            </div>
            
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(dept.id)}
                  className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                    selectedDept === dept.id
                      ? 'bg-[#5500FF] text-white shadow-lg shadow-[#5500FF]/30'
                      : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                >
                  {dept.name}
                  {dept.id !== 'all' && (
                    <span className="ml-1.5 opacity-60">{deptCounts[dept.id] || 0}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Job Cards */}
          <div className={`space-y-4 ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}>
            {filteredJobs.map((job) => (
              <Link
                key={job.id}
                href={`/hiring/${job.slug}`}
                className="block group"
              >
                <div className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-[#5500FF]/30 transition-all duration-300 overflow-hidden">
                  {/* Hover glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-[#5500FF]/10 blur-[80px]" />
                  </div>
                  
                  <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-white group-hover:text-[#907DFF] transition-colors">
                          {job.title}
                        </h3>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#5500FF]/20 text-[#907DFF]">
                          {job.subtitle}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-500 font-light leading-relaxed">
                        {job.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5 text-neutral-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Remote
                        </span>
                        <LevelIndicator level={job.level} />
                      </div>
                      <svg
                        className="w-5 h-5 text-neutral-600 group-hover:text-[#907DFF] group-hover:translate-x-1 transition-all"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {filteredJobs.length === 0 && (
              <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5">
                <p className="text-neutral-500 font-light">No positions found in this department.</p>
                <button 
                  onClick={() => setSelectedDept('all')}
                  className="mt-3 text-sm text-[#907DFF] hover:text-white transition-colors"
                >
                  View all positions
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Link href="/hiring">
                <Image 
                  src="/Comp 2 (0;00;00;00).png" 
                  alt="Divine Acquisition" 
                  width={32} 
                  height={32}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                />
              </Link>
              <span className="text-neutral-600 text-xs font-light">
                © 2026 Divine Acquisition
              </span>
            </div>
            <div className="flex items-center gap-5">
              <a href="https://instagram.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-500 hover:text-[#907DFF] transition-colors">
                Instagram
              </a>
              <a href="https://x.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-500 hover:text-[#907DFF] transition-colors">
                Twitter
              </a>
              <a href="https://divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-500 hover:text-[#907DFF] transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Styles */}
      <style jsx global>{`
        @keyframes floatParticle {
          0% {
            transform: translateY(100vh) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.5;
          }
          90% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-100vh) translateX(50px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
