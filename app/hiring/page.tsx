'use client';

import { useState } from 'react';

const jobs = [
  {
    id: 1,
    title: 'Senior Full-Stack Engineer',
    description: 'Build and scale our core platform infrastructure. Work with Next.js, TypeScript, and cloud technologies.',
    department: 'engineering',
    location: 'remote',
    level: 4,
    date: '2026-01-20',
  },
  {
    id: 2,
    title: 'Backend Engineer',
    description: 'Design and implement scalable APIs and microservices. Experience with Node.js and databases required.',
    department: 'engineering',
    location: 'remote',
    level: 3,
    date: '2026-01-18',
  },
  {
    id: 3,
    title: 'Frontend Developer',
    description: 'Create beautiful, responsive user interfaces. Strong React and CSS skills needed.',
    department: 'engineering',
    location: 'remote',
    level: 2,
    date: '2026-01-15',
  },
  {
    id: 4,
    title: 'Growth Marketing Manager',
    description: 'Drive user acquisition and engagement through data-driven marketing strategies.',
    department: 'growth-marketing',
    location: 'remote',
    level: 3,
    date: '2026-01-19',
  },
  {
    id: 5,
    title: 'Performance Marketer',
    description: 'Manage and optimize paid advertising campaigns across multiple platforms.',
    department: 'growth-marketing',
    location: 'remote',
    level: 2,
    date: '2026-01-17',
  },
  {
    id: 6,
    title: 'Account Executive',
    description: 'Build relationships with enterprise clients and drive revenue growth.',
    department: 'sales',
    location: 'remote',
    level: 3,
    date: '2026-01-16',
  },
  {
    id: 7,
    title: 'Sales Development Rep',
    description: 'Generate and qualify leads through outbound prospecting and research.',
    department: 'sales',
    location: 'remote',
    level: 1,
    date: '2026-01-14',
  },
  {
    id: 8,
    title: 'Client Success Manager',
    description: 'Ensure client satisfaction and retention through proactive relationship management.',
    department: 'client-success',
    location: 'remote',
    level: 3,
    date: '2026-01-13',
  },
];

const departments = [
  { id: 'all', name: 'View All', icon: '◆' },
  { id: 'engineering', name: 'Engineering', icon: '⌘' },
  { id: 'growth-marketing', name: 'Growth & Marketing', icon: '↗' },
  { id: 'sales', name: 'Sales', icon: '◎' },
  { id: 'client-success', name: 'Client Success', icon: '♥' },
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

function LevelIndicator({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-1.5 group-hover:text-[#907DFF]/80 transition-colors">
      <span className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${
              i <= level ? 'bg-[#5500FF] shadow-[0_0_8px_rgba(85,0,255,0.6)]' : 'bg-white/10'
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
    <div className="min-h-screen bg-black text-white selection:bg-[#5500FF]/50 selection:text-purple-50">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10 h-full w-full pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(144,125,255,0.35),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(85,0,255,0.2),rgba(0,0,0,0))]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-20 border-b border-white/5 bg-black/10 backdrop-blur-xl">
        <div className="max-w-[1800px] mx-auto h-full px-6 md:px-8 flex items-center justify-between">
          <div className="text-xl font-semibold tracking-tight">
            <span className="text-white">Divine</span>
            <span className="text-[#907DFF]">Acquisition</span>
          </div>
          <a
            href="#open-roles"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-medium
                       bg-white/10 border border-white/10 text-white
                       hover:bg-white hover:text-black hover:shadow-[0_0_25px_-5px_rgba(255,255,255,0.2)]
                       transition-all duration-300 hover:-translate-y-0.5"
          >
            View Open Roles
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 md:px-8 pt-32 pb-24 md:pt-40 md:pb-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium
                          text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-10
                          shadow-[0_0_20px_-5px_rgba(144,125,255,0.3)] fade-enter">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#5500FF]" />
            </span>
            Recruiting Top 1% Talent
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-8xl font-medium text-white tracking-tighter mb-8 leading-[0.9] drop-shadow-lg fade-enter"
              style={{ animationDelay: '0.1s' }}>
            Build the engine of
            <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-[#907DFF] to-[#5500FF]">
              autonomous revenue.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed font-light tracking-tight fade-enter"
             style={{ animationDelay: '0.2s' }}>
            We are building <span className="text-white font-medium">DivineAcquisition</span>,
            the future of AI-powered client acquisition. Join us in revolutionizing how businesses grow.
          </p>

          {/* Scroll Indicator */}
          <div className="mt-24 flex justify-center w-full fade-enter" style={{ animationDelay: '0.3s' }}>
            <a
              href="#open-roles"
              className="flex items-center justify-center text-neutral-300
                         transition-all duration-300 animate-bounce p-3 rounded-full bg-white/5
                         border border-white/10 backdrop-blur-sm
                         shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)]
                         hover:text-[#907DFF] hover:border-[#907DFF]/50
                         hover:bg-[#5500FF]/10 hover:shadow-[0_0_20px_-5px_rgba(144,125,255,0.3)]"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="w-full px-6 md:px-8 pb-12 md:pb-20 scroll-mt-24" id="open-roles">
        <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Sidebar */}
          <aside className="lg:col-span-3 lg:sticky lg:top-28 h-fit fade-enter" style={{ animationDelay: '0.1s' }}>
            <div className="bg-neutral-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-xl shadow-[#5500FF]/10">
              {/* Department Filter */}
              <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
                Department
              </h3>
              <div className="space-y-1 mb-8">
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => setSelectedDept(dept.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex justify-between items-center group transition-all ${
                      selectedDept === dept.id
                        ? 'bg-white text-black font-medium shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5 font-light'
                    }`}
                  >
                    {dept.name}
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        selectedDept === dept.id
                          ? 'text-black/60 bg-black/5'
                          : 'text-neutral-400 bg-white/5 group-hover:text-white group-hover:bg-white/10'
                      }`}
                    >
                      {dept.id === 'all' ? jobs.length : deptCounts[dept.id] || 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* Location Filter */}
              <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
                Location
              </h3>
              <label className="flex items-center gap-3 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={remoteOnly}
                  onChange={(e) => setRemoteOnly(e.target.checked)}
                  className="peer sr-only"
                />
                <div className={`relative flex items-center justify-center w-4 h-4
                                border rounded transition-all duration-200
                                ${remoteOnly
                                  ? 'bg-[#5500FF] border-[#5500FF] shadow-[0_0_10px_rgba(85,0,255,0.4)]'
                                  : 'border-neutral-600 bg-transparent group-hover:border-[#907DFF]'
                                }`}>
                  {remoteOnly && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-light text-neutral-400 group-hover:text-white transition-colors">
                  Remote Only
                </span>
              </label>
            </div>
          </aside>

          {/* Job Listings */}
          <div className="lg:col-span-9 space-y-12 fade-enter" style={{ animationDelay: '0.2s' }}>
            {Object.entries(groupedJobs).map(([deptId, deptJobs]) => {
              const dept = departments.find((d) => d.id === deptId);
              return (
                <section key={deptId}>
                  <h2 className="text-lg font-medium text-white tracking-tight mb-6 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-[#907DFF]">
                      {dept?.icon}
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
                        <div className="flex flex-col h-full justify-between gap-8">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="text-base font-medium text-white group-hover:text-[#907DFF] transition-colors">
                                {job.title}
                              </h3>
                              <svg
                                className="w-5 h-5 text-neutral-600 group-hover:text-[#907DFF] transition-colors"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                              </svg>
                            </div>
                            <p className="text-sm text-neutral-400 font-light line-clamp-2">
                              {job.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-neutral-500 font-medium">
                            <span className="flex items-center gap-1.5 group-hover:text-[#907DFF]/80 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {job.location === 'remote' ? 'Remote' : job.location}
                            </span>
                            <LevelIndicator level={job.level} />
                            <span className="flex items-center gap-1.5 group-hover:text-neutral-400 transition-colors ml-auto">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
              <div className="text-center py-16">
                <p className="text-neutral-400">No positions found matching your criteria.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="z-10 border-white/10 border-t mt-auto pt-16 pb-16 relative">
        <div className="w-full px-6 md:px-8 flex flex-col md:flex-row justify-between items-center gap-8 max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold tracking-tight">
              <span className="text-white">Divine</span>
              <span className="text-[#907DFF]">Acquisition</span>
            </span>
            <span className="text-neutral-500 font-medium text-sm tracking-tight">
              © 2026 DivineAcquisition
            </span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors">
              Instagram
            </a>
            <a href="#" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors">
              Twitter
            </a>
            <a href="#" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors">
              Privacy
            </a>
            <a href="#" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
