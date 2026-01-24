'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const jobs = [
  {
    id: 1,
    slug: 'system-integrator',
    title: 'System Integrator',
    subtitle: 'Infrastructure',
    description: 'Connect software platforms and create seamless workflows. Design, implement, and maintain integration solutions using Zapier, Airtable, GoHighLevel, and REST APIs.',
    department: 'systems',
    location: 'remote',
    level: 3,
  },
  {
    id: 2,
    slug: 'media-buyer',
    title: 'Media Buyer',
    subtitle: 'Growth',
    description: 'Architect paid acquisition systems that drive qualified pipeline. Build evidence based campaigns across Meta, Google, and TikTok that compound results over time.',
    department: 'growth',
    location: 'remote',
    level: 3,
  },
  {
    id: 3,
    slug: 'setter',
    title: 'Setter',
    subtitle: 'Sales Development',
    description: 'Book the right calls with high quality prospects. Identify fit, educate on what\'s possible, and qualify opportunities for our closers.',
    department: 'sales',
    location: 'remote',
    level: 1,
  },
  {
    id: 4,
    slug: 'closer',
    title: 'Closer',
    subtitle: 'Sales',
    description: 'Convert qualified opportunities into long term client partnerships. Guide prospects through decision making and demonstrate how our infrastructure transforms businesses.',
    department: 'sales',
    location: 'remote',
    level: 3,
  },
  {
    id: 5,
    slug: 'client-success',
    title: 'Client Success Manager',
    subtitle: 'Client Success',
    description: 'Own client relationships from onboarding to outcomes. Ensure our retention systems deliver measurable, compounding results.',
    department: 'client-success',
    location: 'remote',
    level: 3,
  },
];

const departments = [
  { id: 'all', name: 'View All' },
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
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              i <= level ? 'bg-[#5500FF] shadow-[0_0_6px_rgba(85,0,255,0.6)]' : 'bg-white/10'
            }`}
          />
        ))}
      </span>
      {levelLabels[level]}
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
    <div className="min-h-screen bg-black text-white antialiased selection:bg-[#5500FF]/50 selection:text-purple-50">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10 h-full w-full pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(144,125,255,0.35),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(85,0,255,0.2),rgba(0,0,0,0))]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-white/5 bg-black/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/hiring" className="flex items-center gap-2.5 group">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={28} 
              height={28}
              className="group-hover:opacity-80 transition-opacity"
            />
            <span className="text-base font-semibold tracking-tight text-white group-hover:text-[#907DFF] transition-colors hidden sm:block">
              Divine Acquisition
            </span>
          </Link>
          
          <a
            href="https://divineacquisition.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Visit Website
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 pt-28 pb-16 md:pt-32 md:pb-20">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div 
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium
                        text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-8
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
            className={`text-4xl sm:text-5xl md:text-6xl font-medium text-white tracking-tight mb-6 leading-[1.1]
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
          >
            Build systems that
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#907DFF] to-[#5500FF]"> compound.</span>
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-lg text-neutral-400 leading-relaxed font-light max-w-2xl mx-auto mb-10
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            We build infrastructure, not gimmicks. Join us in creating timeless business systems 
            for service based companies.
          </p>

          {/* Values */}
          <div 
            className={`flex flex-wrap justify-center gap-3 mb-8
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-neutral-400">
              Devotion
            </span>
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-neutral-400">
              Innovation
            </span>
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-neutral-400">
              Value
            </span>
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-neutral-400">
              Exclusivity
            </span>
          </div>
        </div>
      </section>

      {/* Positions Section */}
      <main className="px-6 pb-20" id="positions">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}>
            <div>
              <h2 className="text-2xl font-medium text-white tracking-tight">Open Positions</h2>
              <p className="text-neutral-500 text-sm mt-1">{jobs.length} roles available</p>
            </div>
            
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(dept.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedDept === dept.id
                      ? 'bg-[#5500FF] text-white'
                      : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
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
          <div className={`space-y-3 ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}>
            {filteredJobs.map((job) => (
              <Link
                key={job.id}
                href={`/hiring/${job.slug}`}
                className="block group"
              >
                <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-[#5500FF]/30 transition-all duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-medium text-white group-hover:text-[#907DFF] transition-colors">
                          {job.title}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#5500FF]/20 text-[#907DFF]">
                          {job.subtitle}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-500 font-light leading-relaxed line-clamp-2">
                        {job.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <span className="flex items-center gap-1.5">
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
              <div className="text-center py-12">
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

      {/* Culture Section */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="p-8 rounded-2xl bg-gradient-to-br from-[#5500FF]/10 via-transparent to-transparent border border-[#5500FF]/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-lg font-medium text-white mb-4">How We Operate</h2>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-sm text-neutral-400 font-light">
                    <span className="w-1 h-1 rounded-full bg-[#907DFF]" />
                    Evidence over assumption
                  </li>
                  <li className="flex items-center gap-3 text-sm text-neutral-400 font-light">
                    <span className="w-1 h-1 rounded-full bg-[#907DFF]" />
                    Process over personality
                  </li>
                  <li className="flex items-center gap-3 text-sm text-neutral-400 font-light">
                    <span className="w-1 h-1 rounded-full bg-[#907DFF]" />
                    Simplicity scales
                  </li>
                  <li className="flex items-center gap-3 text-sm text-neutral-400 font-light">
                    <span className="w-1 h-1 rounded-full bg-[#907DFF]" />
                    We win when clients win
                  </li>
                </ul>
              </div>
              <div>
                <h2 className="text-lg font-medium text-white mb-4">What We Build</h2>
                <p className="text-sm text-neutral-400 font-light leading-relaxed">
                  Divine Acquisition is a growth consulting and systems implementation firm. 
                  We build retention first infrastructures, automation systems, and client success 
                  engines for service based businesses. We don&apos;t sell gimmicks. We build infrastructure.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Link href="/hiring" className="flex items-center gap-2 group">
                <Image 
                  src="/logo.png" 
                  alt="Divine Acquisition" 
                  width={20} 
                  height={20}
                  className="opacity-70 group-hover:opacity-100 transition-opacity"
                />
              </Link>
              <span className="text-neutral-600 text-sm font-light">
                © 2026 Divine Acquisition
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://instagram.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors font-light">
                Instagram
              </a>
              <a href="https://x.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors font-light">
                Twitter
              </a>
              <a href="#" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors font-light">
                LinkedIn
              </a>
              <a href="https://divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors font-light">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
