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
    department: 'operations',
    location: 'remote',
    region: 'United States, MD',
    timezone: 'EST',
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
    region: 'United States, MD',
    timezone: 'EST',
    level: 3,
  },
  {
    id: 3,
    slug: 'setter',
    title: 'SDR / Setter',
    subtitle: 'Sales Development',
    description: 'Book the right calls with high quality prospects. Identify fit, educate on possibilities, and qualify opportunities for our closers.',
    department: 'sales',
    location: 'remote',
    region: 'United States, MD',
    timezone: 'EST',
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
    region: 'United States, MD',
    timezone: 'EST',
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
    region: 'United States, MD',
    timezone: 'EST',
    level: 3,
  },
];

const departments = [
  { id: 'all', name: 'View All' },
  { id: 'operations', name: 'Operations' },
  { id: 'growth', name: 'Growth & Marketing' },
  { id: 'sales', name: 'Sales' },
  { id: 'client-success', name: 'Client Success' },
];

const locations = [
  { id: 'remote', name: 'Remote' },
  { id: 'us-md', name: 'United States, MD' },
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
              i <= level ? 'bg-[#907DFF] shadow-[0_0_8px_rgba(144,125,255,0.9)]' : 'bg-white/10'
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
  const [selectedLocations, setSelectedLocations] = useState<string[]>(['remote', 'us-md']);
  const [sortBy, setSortBy] = useState('level-high');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleLocation = (locationId: string) => {
    setSelectedLocations(prev => 
      prev.includes(locationId) 
        ? prev.filter(l => l !== locationId)
        : [...prev, locationId]
    );
  };

  const filteredJobs = jobs
    .filter((job) => {
      if (selectedDept !== 'all' && job.department !== selectedDept) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'level-high') return b.level - a.level;
      if (sortBy === 'level-low') return a.level - b.level;
      return 0;
    });

  const deptCounts = jobs.reduce((acc, job) => {
    acc[job.department] = (acc[job.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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

      {/* Background Glow Effects - Deep #6200FF for banner */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Main banner glow - deep purple #6200FF */}
        <div 
          className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-full md:w-[1400px] h-[900px] md:h-[1100px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(98,0,255,0.5) 0%, rgba(98,0,255,0.25) 30%, rgba(144,125,255,0.1) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Bottom right glow - #907DFF accent */}
        <div 
          className="absolute bottom-[-15%] right-[-5%] w-[700px] h-[700px] rounded-full opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.5) 0%, rgba(98,0,255,0.2) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Left side glow */}
        <div 
          className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.4) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-28 border-b border-white/5 bg-[#0a0a0a]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/hiring" className="group">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={200} 
              height={200}
              className="group-hover:opacity-80 transition-opacity"
            />
          </Link>
          
          <a
            href="#positions"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.5)]"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            {jobs.length} Open Roles
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-44 pb-16 md:pt-52 md:pb-20">
        <div className="max-w-3xl mx-auto text-center">
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
            We&apos;re Hiring
          </div>

          {/* Headline */}
          <h1 
            className={`text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-6 leading-[1.15] text-transparent bg-clip-text
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 30%, #907DFF 60%, #5500FF 100%)',
            }}
          >
            Curating The Engine To Create Trust, Revenue & Retention.
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-xl text-neutral-400 leading-relaxed font-light max-w-2xl mx-auto mb-12
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            We are building infrastructure that compounds trust, revenue & retention for service based businesses. We are looking for those devoted to building DivineAcquisition™ & our future projects.
          </p>

          {/* Values */}
          <div 
            className={`flex flex-wrap justify-center gap-3
                        ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}
          >
            {['Devotion', 'Value', 'Exclusivity'].map((value) => (
              <span 
                key={value}
                className="px-4 py-2 rounded-full text-sm font-medium bg-[#907DFF]/5 border border-[#907DFF]/20 text-neutral-300 hover:border-[#907DFF]/40 hover:shadow-[0_0_20px_rgba(144,125,255,0.2)] transition-all"
              >
                {value}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Positions Section */}
      <main className="relative z-10 px-6 pb-20" id="positions">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-8">
            
            {/* Sidebar Filter */}
            <aside className={`lg:w-72 flex-shrink-0 ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}>
              <div className="lg:sticky lg:top-32 space-y-8 p-6 rounded-2xl bg-white/[0.02] border border-white/5 shadow-[0_0_30px_rgba(144,125,255,0.05)]">
                
                {/* Department Filter */}
                <div>
                  <h3 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">Department</h3>
                  <div className="space-y-1">
                    {departments.map((dept) => {
                      const count = dept.id === 'all' ? jobs.length : (deptCounts[dept.id] || 0);
                      const isSelected = selectedDept === dept.id;
                      return (
                        <button
                          key={dept.id}
                          onClick={() => setSelectedDept(dept.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-white/5 text-white border border-white/10'
                              : 'text-neutral-400 hover:text-white hover:bg-white/[0.02]'
                          }`}
                        >
                          <span>{dept.name}</span>
                          <span className={`text-xs ${isSelected ? 'text-white' : 'text-neutral-600'}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Location Filter */}
                <div>
                  <h3 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">Location</h3>
                  <div className="space-y-2">
                    {locations.map((location) => (
                      <label
                        key={location.id}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <div 
                          className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                            selectedLocations.includes(location.id)
                              ? 'bg-[#5500FF] border-[#5500FF]'
                              : 'bg-white/5 border border-white/10 group-hover:border-white/20'
                          }`}
                          onClick={() => toggleLocation(location.id)}
                        >
                          {selectedLocations.includes(location.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-neutral-400 group-hover:text-white transition-colors">
                          {location.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Time Zone */}
                <div>
                  <h3 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">Time Zone</h3>
                  <div className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-sm text-neutral-300">
                    EST (Eastern Standard Time)
                  </div>
                </div>

                {/* Sort By */}
                <div>
                  <h3 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">Sort By</h3>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full appearance-none px-4 py-3 pr-10 rounded-xl bg-white/[0.02] border border-white/5 text-sm text-neutral-300 focus:outline-none focus:border-[#5500FF]/50 cursor-pointer"
                    >
                      <option value="level-high" className="bg-[#0a0a0a]">Level: High to Low</option>
                      <option value="level-low" className="bg-[#0a0a0a]">Level: Low to High</option>
                    </select>
                    <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </div>
                </div>

              </div>
            </aside>

            {/* Job Listings */}
            <div className="flex-1">
              {/* Header */}
              <div className={`flex items-center justify-between mb-6 ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}>
                <div>
                  <h2 className="text-2xl font-semibold text-white tracking-tight">Open Positions</h2>
                  <p className="text-neutral-500 text-sm mt-1">{filteredJobs.length} roles available</p>
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
                    <div className="relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-[#907DFF]/50 hover:shadow-[0_0_30px_rgba(144,125,255,0.25),inset_0_0_20px_rgba(144,125,255,0.05)] transition-all duration-300 overflow-hidden">
                      {/* Hover glow */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-[#907DFF]/20 blur-[60px]" />
                      </div>
                      
                      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-white group-hover:text-[#907DFF] transition-colors">
                              {job.title}
                            </h3>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#907DFF]/15 text-[#907DFF] shadow-[0_0_10px_rgba(144,125,255,0.3)]">
                          {job.subtitle}
                        </span>
                          </div>
                          <p className="text-sm text-neutral-500 font-light leading-relaxed mb-3">
                            {job.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                            <span className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {job.region}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-neutral-600" />
                            <span>{job.timezone}</span>
                            <span className="w-1 h-1 rounded-full bg-neutral-600" />
                            <span className="capitalize">{job.location}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <LevelIndicator level={job.level} />
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
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Link href="/hiring">
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
              <a href="https://divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
