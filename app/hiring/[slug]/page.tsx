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
    description: 'Architect paid acquisition systems that drive qualified pipeline for our clients. Build evidence based campaigns that compound results over time.',
    fullDescription: `We're looking for a Media Buyer who understands that advertising is infrastructure, not guesswork.

At Divine Acquisition, we build retention first systems for service based businesses. Our Media Buyers don't chase vanity metrics. They architect paid acquisition systems that deliver predictable, compounding returns.

You'll work directly with our clients to understand their ideal customer profile, then build and optimize campaigns across Meta, Google, and emerging platforms that feed their sales infrastructure with qualified opportunities.`,
    responsibilities: [
      'Architect and optimize paid media campaigns that integrate with our clients\' retention systems',
      'Build evidence based targeting strategies using data, not assumptions',
      'Manage and scale ad spend while maintaining or improving ROAS benchmarks',
      'Create systematic testing frameworks for creative, audiences, and landing pages',
      'Document and systematize winning campaign structures for repeatability',
      'Collaborate with our Systems team to ensure seamless lead flow into client CRMs',
    ],
    requirements: [
      '3+ years managing paid media for service based or B2B businesses',
      'Proven track record managing $50K+ monthly ad spend profitably',
      'Deep expertise in Meta Ads Manager; Google Ads experience preferred',
      'Systems thinker. You build processes, not one off campaigns',
      'Strong analytical skills and comfort with data driven decision making',
      'Clear communicator who can translate performance data into client insights',
    ],
    whatWeOffer: [
      'Work on infrastructure that compounds, not throwaway campaigns',
      'Direct access to leadership and fast decision making',
      'Remote first culture with async communication',
      'Opportunity to build systems used across our entire client portfolio',
    ],
    department: 'Growth',
    location: 'Remote',
    type: 'Full Time',
    level: 'Senior',
  },
  {
    id: 2,
    slug: 'system-integrator',
    title: 'System Integrator',
    description: 'Build the infrastructure that powers client success. Design and implement automation workflows, CRM systems, and AI enabled processes.',
    fullDescription: `We're looking for a System Integrator who believes that great infrastructure is invisible. It just works.

Divine Acquisition builds retention first systems for service based businesses. Our System Integrators are the architects behind our Retention OS. They design and implement the automation workflows, CRM configurations, and AI enabled processes that help our clients acquire, convert, and retain customers.

You'll own the technical implementation of our proprietary frameworks, ensuring seamless data flow across every touchpoint in the client journey.`,
    responsibilities: [
      'Design and implement CRM systems, automation workflows, and client success infrastructure',
      'Build integrations between platforms (HubSpot, Salesforce, GoHighLevel, Zapier, Make, custom APIs)',
      'Configure and optimize AI enabled workflows for client communication and follow up',
      'Create systematic documentation for all implementations (process over personality)',
      'Troubleshoot and resolve integration issues with speed and precision',
      'Collaborate with Client Success to ensure systems deliver measurable outcomes',
    ],
    requirements: [
      '3+ years in systems integration, automation, or technical implementation',
      'Expert level proficiency with CRM platforms (HubSpot, Salesforce, or GoHighLevel)',
      'Strong experience with automation tools (Zapier, Make, n8n) and API integrations',
      'Understanding of sales and marketing funnels from a technical perspective',
      'Systematic approach to documentation and knowledge transfer',
      'Comfort working in a fast paced environment where quality control is non negotiable',
    ],
    whatWeOffer: [
      'Build systems that become the backbone of client businesses',
      'Work with cutting edge AI and automation tools',
      'Direct impact on client outcomes, not buried in a dev queue',
      'Remote first with flexible async collaboration',
    ],
    department: 'Systems',
    location: 'Remote',
    type: 'Full Time',
    level: 'Senior',
  },
  {
    id: 3,
    slug: 'client-success',
    title: 'Client Success Manager',
    description: 'Own the client relationship from onboarding to outcomes. Ensure our retention systems deliver measurable, compounding results.',
    fullDescription: `We're looking for a Client Success Manager who understands that we win only when the client wins.

At Divine Acquisition, Client Success isn't a support function. It's the heartbeat of our business. You'll own the client relationship from onboarding through ongoing success, ensuring our Retention OS delivers the measurable, compounding results we promise.

You'll be the trusted advisor who helps clients adopt our systems, interprets their data, and proactively identifies opportunities for growth. Devotion to client outcomes isn't just a value. It's the job.`,
    responsibilities: [
      'Own the end to end client relationship from onboarding to retention',
      'Ensure clients successfully adopt and utilize our retention infrastructure',
      'Conduct regular business reviews focused on outcomes, not activity',
      'Proactively identify risks to client success and mobilize internal resources',
      'Translate complex system data into actionable insights for clients',
      'Collaborate with Systems and Growth teams to optimize client results',
    ],
    requirements: [
      '3+ years in client success, account management, or consulting (B2B preferred)',
      'Track record of retaining and growing client relationships',
      'Strong understanding of CRM systems and marketing/sales infrastructure',
      'Excellent communication. You can explain complex systems simply',
      'Data literate: comfortable pulling insights from dashboards and reports',
      'High accountability. You own outcomes, not just activities',
    ],
    whatWeOffer: [
      'Direct ownership of client relationships, not ticket taker work',
      'Work with sophisticated service businesses ready to invest in growth',
      'Compensation tied to client outcomes, not just retention',
      'Remote first culture built on trust and accountability',
    ],
    department: 'Client Success',
    location: 'Remote',
    type: 'Full Time',
    level: 'Senior',
  },
  {
    id: 4,
    slug: 'sdr',
    title: 'SDR / Sales Development Representative',
    description: 'Identify and qualify service based businesses ready to install retention infrastructure. Belief shaping over hard selling.',
    fullDescription: `We're looking for an SDR who understands that belief shaping beats hard selling.

Divine Acquisition helps service based businesses install retention infrastructure that compounds trust, revenue, and client lifetime value. As an SDR, you'll be the first point of contact for businesses exploring whether our systems are right for them.

This isn't about volume and pressure. It's about identifying fit, educating prospects on what's possible, and qualifying opportunities for our closers. We're not for everybody, and that's by design. Your job is to find the businesses that are ready.`,
    responsibilities: [
      'Prospect and identify service based businesses that fit our ideal client profile',
      'Conduct discovery conversations focused on understanding, not pitching',
      'Educate prospects on retention infrastructure and what outcomes are possible',
      'Qualify opportunities based on fit, not just interest (exclusivity matters)',
      'Maintain disciplined CRM hygiene and pipeline documentation',
      'Collaborate with closers to ensure smooth handoffs and context transfer',
    ],
    requirements: [
      '0 to 2 years in sales, business development, or client facing roles',
      'Strong written and verbal communication skills',
      'Coachable mindset, eager to learn and implement feedback',
      'Comfort with outbound prospecting (cold email, LinkedIn, phone)',
      'Interest in B2B services, marketing technology, or business systems',
      'Self motivated with high personal accountability',
    ],
    whatWeOffer: [
      'Learn consultative sales at a company that doesn\'t believe in sleazy tactics',
      'Clear path to Account Executive role based on performance',
      'Direct mentorship from experienced closers',
      'Remote first culture with structured training and support',
    ],
    department: 'Sales',
    location: 'Remote',
    type: 'Full Time',
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
        <div className="max-w-5xl mx-auto h-full px-6 md:px-8 flex items-center justify-between">
          <Link href="/hiring" className="flex items-center gap-2.5 group">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={24} 
              height={24}
              className="group-hover:opacity-80 transition-opacity"
            />
            <span className="text-lg font-semibold tracking-tight text-white group-hover:text-[#907DFF] transition-colors">
              Divine Acquisition
            </span>
          </Link>
          
          <Link
            href="/hiring"
            className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            All Positions
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-28 pb-20 px-6 md:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header Section */}
          <div className="mb-12">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#5500FF] text-white">
                {job.department}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-neutral-400 border border-white/10">
                {job.location}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-neutral-400 border border-white/10">
                {job.type}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-neutral-400 border border-white/10">
                {job.level}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium text-white tracking-tight mb-4">
              {job.title}
            </h1>
            <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-3xl">
              {job.description}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Job Details - Left Column */}
            <div className="lg:col-span-3 space-y-10">
              {/* About */}
              <section>
                <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">About This Role</h2>
                <div className="text-neutral-300 font-light leading-relaxed whitespace-pre-line">
                  {job.fullDescription}
                </div>
              </section>

              {/* Responsibilities & Requirements Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <section>
                  <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">What You&apos;ll Do</h2>
                  <ul className="space-y-3">
                    {job.responsibilities.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 text-neutral-400 font-light text-sm">
                        <svg className="w-4 h-4 text-[#907DFF] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">What We Need</h2>
                  <ul className="space-y-3">
                    {job.requirements.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 text-neutral-400 font-light text-sm">
                        <svg className="w-4 h-4 text-[#5500FF] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {/* What We Offer */}
              <section className="p-6 bg-neutral-900/40 border border-white/5 rounded-xl">
                <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">What You Get</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {job.whatWeOffer.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 text-neutral-400 font-light text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#907DFF] mt-1.5 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              {/* Who We Are */}
              <section className="p-6 bg-gradient-to-br from-[#5500FF]/10 to-transparent border border-[#5500FF]/20 rounded-xl">
                <h2 className="text-sm font-medium text-[#907DFF] uppercase tracking-wider mb-3">Who We Are</h2>
                <p className="text-sm text-neutral-300 font-light leading-relaxed">
                  Divine Acquisition is not for everybody. We value devotion, innovation, and exclusivity. 
                  We hire people who believe that process beats personality, evidence beats assumption, 
                  and simplicity scales. If that resonates, we want to hear from you.
                </p>
              </section>
            </div>

            {/* Application Form - Right Column */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-28">
                <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl shadow-[#5500FF]/5">
                  <h2 className="text-lg font-medium text-white mb-1">Apply Now</h2>
                  <p className="text-xs text-neutral-500 font-light mb-6">We review every application personally.</p>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">First Name</label>
                        <input
                          type="text"
                          required
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
                                     placeholder-neutral-600 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                     transition-all"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">Last Name</label>
                        <input
                          type="text"
                          required
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
                                     placeholder-neutral-600 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                     transition-all"
                          placeholder="Doe"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">Email</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
                                   placeholder-neutral-600 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                   transition-all"
                        placeholder="john@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
                                   placeholder-neutral-600 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                   transition-all"
                        placeholder="+1 (555) 000 0000"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">LinkedIn</label>
                      <input
                        type="url"
                        value={formData.linkedin}
                        onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
                                   placeholder-neutral-600 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                   transition-all"
                        placeholder="linkedin.com/in/johndoe"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">Resume</label>
                      <div className="relative">
                        <input
                          type="file"
                          required
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => setFormData({ ...formData, resume: e.target.files?.[0] || null })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="w-full bg-white/5 border border-white/10 border-dashed rounded-lg px-3 py-4 text-center
                                        hover:border-[#907DFF]/50 hover:bg-[#5500FF]/5 transition-all">
                          <svg className="w-6 h-6 text-neutral-600 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-xs text-neutral-500">
                            {formData.resume ? formData.resume.name : 'Upload PDF or DOC'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">Why Divine Acquisition?</label>
                      <textarea
                        value={formData.coverLetter}
                        onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white
                                   placeholder-neutral-600 focus:outline-none focus:border-[#907DFF]/50 focus:ring-1 focus:ring-[#907DFF]/50
                                   transition-all resize-none"
                        placeholder="What draws you to building systems that compound?"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-xl text-sm font-medium
                                 bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white
                                 hover:opacity-90 hover:shadow-[0_0_30px_-5px_rgba(85,0,255,0.5)]
                                 transition-all duration-300 mt-2"
                    >
                      Submit Application
                    </button>

                    <p className="text-[10px] text-neutral-600 text-center">
                      By submitting, you agree to our Privacy Policy and Terms.
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
        <div className="max-w-5xl mx-auto px-6 md:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <Link href="/hiring" className="flex items-center gap-2 group">
                <Image 
                  src="/logo.png" 
                  alt="Divine Acquisition" 
                  width={18} 
                  height={18}
                  className="opacity-70 group-hover:opacity-100 transition-opacity"
                />
              </Link>
              <span className="text-neutral-600 text-sm font-light">
                © 2026 Divine Acquisition
              </span>
            </div>
            <div className="flex items-center gap-6">
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
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
