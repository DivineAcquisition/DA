'use client';

import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const jobs = [
  {
    id: 1,
    slug: 'media-buyer',
    title: 'Media Buyer',
    description: 'Manage and optimize paid advertising campaigns across Meta, Google, TikTok, and emerging platforms. Drive ROAS and scale client acquisition.',
    fullDescription: `We're looking for an experienced Media Buyer to join our Growth team. You'll be responsible for managing and scaling paid advertising campaigns across multiple platforms to drive client acquisition and revenue growth.

As a Media Buyer at DivineAcquisition, you'll work directly with our clients to understand their goals and create data-driven advertising strategies that deliver results.`,
    responsibilities: [
      'Plan, execute, and optimize paid media campaigns across Meta, Google, TikTok, and other platforms',
      'Manage advertising budgets and maximize ROAS for client campaigns',
      'Analyze campaign performance data and provide actionable insights',
      'A/B test ad creatives, audiences, and landing pages',
      'Collaborate with the creative team to develop high-performing ad content',
      'Stay up-to-date with platform changes and industry best practices',
    ],
    requirements: [
      '3+ years of experience in paid media/performance marketing',
      'Proven track record of managing $100K+ monthly ad spend',
      'Deep expertise in Meta Ads Manager and Google Ads',
      'Strong analytical skills and experience with data visualization tools',
      'Excellent communication and client management skills',
      'Experience with e-commerce or lead generation campaigns preferred',
    ],
    department: 'Growth & Marketing',
    location: 'Remote',
    type: 'Full-time',
    level: 'Senior',
  },
  {
    id: 2,
    slug: 'system-integrator',
    title: 'System Integrator',
    description: 'Build and maintain integrations between our platform and third-party tools. Ensure seamless data flow and automation across client systems.',
    fullDescription: `We're seeking a talented System Integrator to build and maintain the connections between our platform and the tools our clients use every day.

You'll be responsible for creating robust, scalable integrations that enable seamless data flow and automation across multiple systems.`,
    responsibilities: [
      'Design and implement integrations with CRMs, marketing platforms, and other third-party tools',
      'Build and maintain APIs and webhooks for real-time data synchronization',
      'Troubleshoot and resolve integration issues quickly and efficiently',
      'Document integration processes and create technical specifications',
      'Collaborate with clients to understand their tech stack and integration needs',
      'Optimize existing integrations for performance and reliability',
    ],
    requirements: [
      '3+ years of experience in systems integration or backend development',
      'Strong proficiency in JavaScript/TypeScript and Node.js',
      'Experience with REST APIs, webhooks, and OAuth',
      'Familiarity with popular CRMs (HubSpot, Salesforce) and marketing tools',
      'Understanding of data mapping and transformation',
      'Excellent problem-solving and debugging skills',
    ],
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    level: 'Senior',
  },
  {
    id: 3,
    slug: 'client-success',
    title: 'Client Success Manager',
    description: 'Ensure client satisfaction and retention through proactive relationship management. Help clients achieve their revenue goals with our platform.',
    fullDescription: `We're looking for a Client Success Manager to be the primary point of contact for our clients and ensure they achieve their goals with DivineAcquisition.

You'll build strong relationships, provide strategic guidance, and work cross-functionally to deliver exceptional client experiences.`,
    responsibilities: [
      'Serve as the primary point of contact for a portfolio of clients',
      'Develop and execute client success plans aligned with their business goals',
      'Conduct regular business reviews and identify growth opportunities',
      'Proactively monitor client health metrics and address concerns',
      'Collaborate with internal teams to resolve client issues and implement solutions',
      'Drive client retention, expansion, and advocacy',
    ],
    requirements: [
      '3+ years of experience in client success, account management, or consulting',
      'Proven track record of managing and growing client relationships',
      'Strong understanding of digital marketing and client acquisition strategies',
      'Excellent communication and presentation skills',
      'Data-driven approach to identifying trends and opportunities',
      'Experience with CRM systems and client success platforms',
    ],
    department: 'Client Success',
    location: 'Remote',
    type: 'Full-time',
    level: 'Senior',
  },
  {
    id: 4,
    slug: 'sdr',
    title: 'SDR / Sales Development Representative',
    description: 'Generate and qualify leads through strategic outbound prospecting. First step into a high-growth sales career at a fast-moving company.',
    fullDescription: `We're looking for hungry, ambitious SDRs to join our sales team and help fuel DivineAcquisition's growth.

This is an incredible opportunity to start your sales career at a fast-moving company with massive growth potential. You'll learn the fundamentals of B2B sales while working alongside experienced closers.`,
    responsibilities: [
      'Prospect and identify potential clients through outbound channels',
      'Conduct discovery calls to qualify leads and understand their needs',
      'Schedule meetings and demos for Account Executives',
      'Maintain accurate records in our CRM system',
      'Collaborate with marketing on lead generation campaigns',
      'Meet and exceed monthly activity and pipeline targets',
    ],
    requirements: [
      '0-2 years of experience in sales, customer service, or related field',
      'Strong communication skills and ability to build rapport quickly',
      'Self-motivated with a competitive drive to succeed',
      'Coachable attitude and eagerness to learn',
      'Comfortable with cold outreach via phone, email, and social',
      'Interest in B2B SaaS and digital marketing',
    ],
    department: 'Sales',
    location: 'Remote',
    type: 'Full-time',
    level: 'Entry',
  },
];

export default function JobPage() {
  const params = useParams();
  const job = jobs.find((j) => j.slug === params.slug);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    linkedin: '',
    portfolio: '',
    resume: null as File | null,
    coverLetter: '',
  });

  if (!job) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-medium mb-4">Position not found</h1>
          <Link href="/hiring" className="text-[#907DFF] hover:text-white transition-colors">
            ← Back to all positions
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log('Application submitted:', formData);
    alert('Application submitted successfully!');
  };

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
          <Link href="/hiring" className="flex items-center gap-2.5 group">
            <Image 
              src="/logo.svg" 
              alt="DivineAcquisition" 
              width={24} 
              height={24}
              className="group-hover:opacity-80 transition-opacity"
            />
            <span className="text-lg font-semibold tracking-tight text-white group-hover:text-[#907DFF] transition-colors">
              DivineAcquisition
            </span>
          </Link>
          
          <Link
            href="/hiring"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-medium
                       bg-white/10 border border-white/10 text-white
                       hover:bg-white hover:text-black hover:shadow-[0_0_25px_-5px_rgba(255,255,255,0.2)]
                       transition-all duration-300 hover:-translate-y-0.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            All Positions
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Back Link */}
          <Link 
            href="/hiring" 
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-[#907DFF] transition-colors mb-8 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to all positions
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Job Details */}
            <div className="lg:col-span-7">
              {/* Header */}
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#907DFF]/10 text-[#907DFF] border border-[#907DFF]/30">
                    {job.department}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-neutral-400 border border-white/10">
                    {job.location}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-neutral-400 border border-white/10">
                    {job.type}
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-medium text-white tracking-tight mb-4">
                  {job.title}
                </h1>
                <p className="text-lg text-neutral-400 font-light leading-relaxed">
                  {job.description}
                </p>
              </div>

              {/* About the Role */}
              <div className="mb-10">
                <h2 className="text-xl font-medium text-white mb-4">About the Role</h2>
                <div className="text-neutral-400 font-light leading-relaxed whitespace-pre-line">
                  {job.fullDescription}
                </div>
              </div>

              {/* Responsibilities */}
              <div className="mb-10">
                <h2 className="text-xl font-medium text-white mb-4">Responsibilities</h2>
                <ul className="space-y-3">
                  {job.responsibilities.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-neutral-400 font-light">
                      <svg className="w-5 h-5 text-[#907DFF] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Requirements */}
              <div className="mb-10">
                <h2 className="text-xl font-medium text-white mb-4">Requirements</h2>
                <ul className="space-y-3">
                  {job.requirements.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-neutral-400 font-light">
                      <svg className="w-5 h-5 text-[#5500FF] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Application Form */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-28">
                <div className="bg-neutral-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-xl shadow-[#5500FF]/5">
                  <h2 className="text-xl font-medium text-white mb-6">Apply for this position</h2>
                  
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-2">First Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white
                                     placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                     transition-all"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-2">Last Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white
                                     placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                     transition-all"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-2">Email *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white
                                   placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                   transition-all"
                        placeholder="john@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white
                                   placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                   transition-all"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-2">LinkedIn Profile</label>
                      <input
                        type="url"
                        value={formData.linkedin}
                        onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white
                                   placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                   transition-all"
                        placeholder="https://linkedin.com/in/johndoe"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-2">Portfolio / Website</label>
                      <input
                        type="url"
                        value={formData.portfolio}
                        onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white
                                   placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                   transition-all"
                        placeholder="https://yourwebsite.com"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-2">Resume *</label>
                      <div className="relative">
                        <input
                          type="file"
                          required
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => setFormData({ ...formData, resume: e.target.files?.[0] || null })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="w-full bg-white/5 border border-white/10 border-dashed rounded-lg px-4 py-6 text-center
                                        hover:border-[#907DFF]/50 hover:bg-[#5500FF]/5 transition-all">
                          <svg className="w-8 h-8 text-neutral-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-sm text-neutral-400">
                            {formData.resume ? formData.resume.name : 'Click to upload or drag and drop'}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">PDF, DOC, DOCX (max 10MB)</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-400 mb-2">Cover Letter</label>
                      <textarea
                        value={formData.coverLetter}
                        onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white
                                   placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                   transition-all resize-none"
                        placeholder="Tell us why you're interested in this role..."
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-4 rounded-xl text-sm font-medium
                                 bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white
                                 hover:opacity-90 hover:shadow-[0_0_30px_-5px_rgba(85,0,255,0.5)]
                                 transition-all duration-300"
                    >
                      Submit Application
                    </button>

                    <p className="text-xs text-neutral-500 text-center">
                      By submitting, you agree to our Privacy Policy and Terms of Service.
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-[1800px] mx-auto px-6 md:px-8 py-12 md:py-16">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-4">
              <Link href="/hiring" className="flex items-center gap-2 group">
                <Image 
                  src="/logo.svg" 
                  alt="DivineAcquisition" 
                  width={20} 
                  height={20}
                  className="opacity-70 group-hover:opacity-100 transition-opacity"
                />
              </Link>
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
