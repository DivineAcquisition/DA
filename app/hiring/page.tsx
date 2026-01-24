'use client';

import { useState, useEffect } from 'react';

const jobs = [
  {
    id: 1,
    title: 'Senior Full-Stack Engineer',
    description: 'Build and scale our core platform infrastructure. Work with Next.js, TypeScript, and cloud technologies to create the future of autonomous revenue.',
    department: 'engineering',
    location: 'remote',
    level: 4,
    date: '2026-01-20',
  },
  {
    id: 2,
    title: 'Backend Engineer',
    description: 'Design and implement scalable APIs and microservices. Experience with Node.js, Python, and distributed systems required.',
    department: 'engineering',
    location: 'remote',
    level: 3,
    date: '2026-01-18',
  },
  {
    id: 3,
    title: 'Frontend Developer',
    description: 'Create beautiful, responsive user interfaces that delight our users. Strong React, TypeScript, and CSS skills needed.',
    department: 'engineering',
    location: 'remote',
    level: 2,
    date: '2026-01-15',
  },
  {
    id: 4,
    title: 'Growth Marketing Manager',
    description: 'Drive user acquisition and engagement through data-driven marketing strategies. Own the full funnel from awareness to conversion.',
    department: 'growth-marketing',
    location: 'remote',
    level: 3,
    date: '2026-01-19',
  },
  {
    id: 5,
    title: 'Performance Marketer',
    description: 'Manage and optimize paid advertising campaigns across Meta, Google, TikTok, and emerging platforms.',
    department: 'growth-marketing',
    location: 'remote',
    level: 2,
    date: '2026-01-17',
  },
  {
    id: 6,
    title: 'Content Strategist',
    description: 'Develop compelling content that educates and converts. Experience with B2B SaaS content marketing preferred.',
    department: 'growth-marketing',
    location: 'remote',
    level: 2,
    date: '2026-01-14',
  },
  {
    id: 7,
    title: 'Account Executive',
    description: 'Build relationships with enterprise clients and drive revenue growth. Proven track record in B2B sales required.',
    department: 'sales',
    location: 'remote',
    level: 3,
    date: '2026-01-16',
  },
  {
    id: 8,
    title: 'Sales Development Rep',
    description: 'Generate and qualify leads through strategic outbound prospecting. First step into a high-growth sales career.',
    department: 'sales',
    location: 'remote',
    level: 1,
    date: '2026-01-14',
  },
  {
    id: 9,
    title: 'Client Success Manager',
    description: 'Ensure client satisfaction and retention through proactive relationship management and strategic guidance.',
    department: 'client-success',
    location: 'remote',
    level: 3,
    date: '2026-01-13',
  },
  {
    id: 10,
    title: 'Implementation Specialist',
    description: 'Guide new clients through onboarding and help them achieve their first wins with our platform.',
    department: 'client-success',
    location: 'remote',
    level: 2,
    date: '2026-01-12',
  },
  {
    id: 11,
    title: 'Support Engineer',
    description: 'Provide technical support to clients and work with engineering to resolve complex issues.',
    department: 'client-success',
    location: 'remote',
    level: 2,
    date: '2026-01-11',
  },
];

const departments = [
  { id: 'all', name: 'View All', icon: 'all' },
  { id: 'engineering', name: 'Engineering', icon: 'code' },
  { id: 'growth-marketing', name: 'Growth & Marketing', icon: 'trending' },
  { id: 'sales', name: 'Sales', icon: 'users' },
  { id: 'client-success', name: 'Client Success', icon: 'heart' },
];

const levelLabels: Record<number, string> = {
  1: 'Entry',
  2: 'Mid',
  3: 'Senior',
  4: 'Lead',
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DeptIcon({ icon, className = '' }: { icon: string; className?: string }) {
  switch (icon) {
    case 'code':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case 'trending':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case 'users':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'heart':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
  }
}

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
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredJobs = jobs.filter((job) => {
    if (selectedDept !== 'all' && job.department !== selectedDept) return false;
    if (remoteOnly && job.location !== 'remote') return false;
    return true;
  });

  const groupedJobs = filteredJobs.reduce((acc, job) => {
    if (!acc[job.department]) acc[job.department] = [];
    acc[job.department].push(job);
    return acc;
  }, {} as Record<string, typeof jobs>);

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
      <nav className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-white/5 bg-black/10 backdrop-blur-xl">
        <div className="max-w-[1800px] mx-auto h-full px-6 md:px-8 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#907DFF] to-[#5500FF] flex items-center justify-center">
              <span className="text-white font-bold text-sm">DA</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-white group-hover:text-[#907DFF] transition-colors">
              DivineAcquisition
            </span>
          </a>
          
          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-neutral-400 hover:text-white transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Desktop CTA */}
          <a
            href="#open-roles"
            className="hidden md:inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-medium
                       bg-white/10 border border-white/10 text-white
                       hover:bg-white hover:text-black hover:shadow-[0_0_25px_-5px_rgba(255,255,255,0.2)]
                       transition-all duration-300 hover:-translate-y-0.5"
          >
            View Open Roles
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
          </a>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-black/95 backdrop-blur-xl border-b border-white/5 p-6">
            <a
              href="#open-roles"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center py-3 rounded-full text-sm font-medium
                         bg-white/10 border border-white/10 text-white"
            >
              View Open Roles
            </a>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="px-6 md:px-8 pt-32 pb-20 md:pt-44 md:pb-28">
        <div className="max-w-4xl mx-auto text-center">
          {/* Status Badge */}
          <div 
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium
                        text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-10
                        shadow-[0_0_20px_-5px_rgba(144,125,255,0.3)]
                        ${mounted ? 'animate-fade-in' : 'opacity-0'}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5500FF]" />
            </span>
            Recruiting Top 1% Talent
          </div>

          {/* Main Headline */}
          <h1 
            className={`text-[2.75rem] sm:text-6xl md:text-7xl lg:text-8xl font-medium text-white tracking-tighter mb-8 leading-[0.95]
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
          >
            Build the engine of
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-[#907DFF] to-[#5500FF]">
              autonomous revenue.
            </span>
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed font-light tracking-tight
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            We are building <span className="text-white font-medium">DivineAcquisition</span>,
            the future of AI-powered client acquisition. Join us in revolutionizing how businesses grow.
          </p>

          {/* Scroll Indicator */}
          <div 
            className={`mt-20 md:mt-24 flex justify-center w-full
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            <a
              href="#open-roles"
              className="flex items-center justify-center text-neutral-400
                         transition-all duration-300 animate-bounce p-3 rounded-full bg-white/5
                         border border-white/10 backdrop-blur-sm
                         hover:text-[#907DFF] hover:border-[#907DFF]/50
                         hover:bg-[#5500FF]/10 hover:shadow-[0_0_20px_-5px_rgba(144,125,255,0.3)]"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="w-full px-6 md:px-8 pb-16 md:pb-24 scroll-mt-24" id="open-roles">
        <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Sidebar */}
          <aside 
            className={`lg:col-span-3 lg:sticky lg:top-28 h-fit
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
          >
            <div className="bg-neutral-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-xl shadow-[#5500FF]/5">
              {/* Department Filter */}
              <h3 className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-4">
                Department
              </h3>
              <div className="space-y-1 mb-8">
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => setSelectedDept(dept.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex justify-between items-center group transition-all duration-200 ${
                      selectedDept === dept.id
                        ? 'bg-white text-black font-medium shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5 font-light'
                    }`}
                  >
                    <span>{dept.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full tabular-nums ${
                        selectedDept === dept.id
                          ? 'text-black/60 bg-black/10'
                          : 'text-neutral-500 bg-white/5 group-hover:text-neutral-300 group-hover:bg-white/10'
                      }`}
                    >
                      {dept.id === 'all' ? jobs.length : deptCounts[dept.id] || 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* Location Filter */}
              <h3 className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-4">
                Location
              </h3>
              <label className="flex items-center gap-3 cursor-pointer group select-none py-1">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={remoteOnly}
                    onChange={(e) => setRemoteOnly(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center
                                  ${remoteOnly
                                    ? 'bg-[#5500FF] border-[#5500FF] shadow-[0_0_12px_rgba(85,0,255,0.5)]'
                                    : 'border-neutral-600 bg-transparent group-hover:border-[#907DFF]/60'
                                  }`}>
                    <svg 
                      className={`w-3 h-3 text-white transition-all duration-200 ${remoteOnly ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-sm font-light text-neutral-400 group-hover:text-white transition-colors">
                  Remote
                </span>
              </label>
            </div>
          </aside>

          {/* Job Listings */}
          <div 
            className={`lg:col-span-9 space-y-12
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            {Object.entries(groupedJobs).map(([deptId, deptJobs]) => {
              const dept = departments.find((d) => d.id === deptId);
              return (
                <section key={deptId}>
                  <h2 className="text-base font-medium text-white tracking-tight mb-5 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#907DFF]">
                      <DeptIcon icon={dept?.icon || 'all'} className="w-[18px] h-[18px]" />
                    </span>
                    {dept?.name}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {deptJobs.map((job) => (
                      <a
                        key={job.id}
                        href={`/hiring/${job.id}`}
                        className="job-card block group overflow-hidden rounded-xl p-6 relative"
                      >
                        <div className="flex flex-col h-full justify-between gap-6">
                          <div>
                            <div className="flex justify-between items-start gap-4 mb-2">
                              <h3 className="text-[15px] font-medium text-white group-hover:text-[#907DFF] transition-colors leading-snug">
                                {job.title}
                              </h3>
                              <svg
                                className="w-5 h-5 text-neutral-600 group-hover:text-[#907DFF] transition-colors flex-shrink-0 mt-0.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                              </svg>
                            </div>
                            <p className="text-sm text-neutral-500 font-light leading-relaxed line-clamp-2">
                              {job.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-[11px] text-neutral-500 font-medium tracking-wide">
                            <span className="flex items-center gap-1.5 group-hover:text-[#907DFF]/70 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {job.location === 'remote' ? 'Remote' : job.location}
                            </span>
                            <span className="group-hover:text-[#907DFF]/70 transition-colors">
                              <LevelIndicator level={job.level} />
                            </span>
                            <span className="flex items-center gap-1.5 ml-auto group-hover:text-neutral-400 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {formatDate(job.date)}
                            </span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </section>
              );
            })}

            {filteredJobs.length === 0 && (
              <div className="text-center py-20 bg-neutral-900/20 rounded-2xl border border-white/5">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                  <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-neutral-400 font-light">No positions found matching your criteria.</p>
                <button 
                  onClick={() => { setSelectedDept('all'); setRemoteOnly(false); }}
                  className="mt-4 text-sm text-[#907DFF] hover:text-white transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-auto">
        <div className="max-w-[1800px] mx-auto px-6 md:px-8 py-12 md:py-16">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-4">
              <a href="/" className="flex items-center gap-2 group">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#907DFF] to-[#5500FF] flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                  <span className="text-white font-bold text-xs">DA</span>
                </div>
              </a>
              <span className="text-neutral-600 text-sm font-light">
                © 2026 DivineAcquisition. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-8">
              <a href="#" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors font-light">
                Instagram
              </a>
              <a href="#" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors font-light">
                Twitter
              </a>
              <a href="#" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors font-light">
                LinkedIn
              </a>
              <a href="#" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors font-light">
                Privacy
              </a>
              <a href="#" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors font-light">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
