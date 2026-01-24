'use client';

import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

const jobs: Record<string, {
  title: string;
  subtitle: string;
  location: string;
  type: string;
  description: string;
  sections: Array<{
    title: string;
    type: 'list' | 'text' | 'grid' | 'tags';
    items?: string[];
    content?: string;
    columns?: number;
  }>;
  techStack?: string[];
  airtableEmbed: string;
  airtableHeight: string;
}> = {
  'system-integrator': {
    title: 'System Integrator',
    subtitle: 'Infrastructure',
    location: 'Remote',
    type: 'Full Time',
    description: 'As a System Integrator at Divine Acquisition, you will be responsible for connecting various software platforms and tools to create seamless workflows that support our clients\' business processes. Your role involves designing, implementing, and maintaining efficient and scalable integration solutions that enable our firm and clients to operate at peak performance. You will work closely with our internal teams and clients to understand their needs, optimize systems, and ensure smooth data flows between tools like GoHighLevel, Zapier, and other key software.',
    techStack: ['Zapier', 'Airtable', 'GoHighLevel', 'Lovable', 'REST APIs', 'Webhooks'],
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
        items: [
          'System Design & Implementation: Develop and implement integration workflows tailored to clients\' needs, connecting CRMs, marketing platforms, and other systems.',
          'Automation Management: Leverage automation tools like Zapier to optimize client operations and improve efficiency across systems.',
          'Troubleshooting & Issue Resolution: Identify, analyze, and resolve system integration issues, ensuring minimal downtime and optimal performance.',
          'Client Collaboration: Work closely with clients to understand their specific requirements, provide training, and offer ongoing support for integrations.',
          'System Scalability: Ensure that the solutions implemented are scalable and can adapt to clients\' growing business needs.',
        ],
      },
      {
        title: 'Requirements',
        type: 'list',
        items: [
          'Technical Proficiency: Expertise in system integration tools such as GoHighLevel, Zapier, and similar automation platforms.',
          'Problem Solving Skills: Proven ability to troubleshoot and resolve integration and workflow issues quickly and effectively.',
          'Experience in System Integration: A minimum of 2 to 3 years of experience in designing, implementing, and maintaining system integrations.',
          'Client Centric Mindset: Strong communication skills with a focus on delivering solutions that meet the specific needs of clients.',
          'Adaptability: Ability to work in a fast paced environment and quickly adapt to new technologies, platforms, and client demands.',
        ],
      },
    ],
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pagPWbnh31lQsrT7C/form',
    airtableHeight: '3500',
  },
  'setter': {
    title: 'Setter',
    subtitle: 'Sales Development',
    location: 'Remote',
    type: 'Full Time',
    description: 'As a Setter at Divine Acquisition, your primary goal is to book the right calls with high quality prospects. You\'ll be the first point of contact for businesses exploring whether our retention infrastructure is right for them. This isn\'t about volume and pressure. It\'s about identifying fit, educating prospects on what\'s possible, and qualifying opportunities for our closers.',
    sections: [
      {
        title: 'Who This Is NOT For',
        type: 'list',
        items: [
          'People looking for a "get rich quick" opportunity',
          'Those who can\'t handle rejection or need constant validation',
          'Anyone who isn\'t coachable or thinks they already know everything',
          'People who make excuses instead of finding solutions',
          'Those who aren\'t willing to put in the work to master their craft',
        ],
      },
      {
        title: 'Who This IS For',
        type: 'list',
        items: [
          'Hungry individuals who want to build a real sales career',
          'People who understand that belief shaping beats hard selling',
          'Self starters who take ownership of their results',
          'Those who are genuinely curious about businesses and their challenges',
          'Individuals who can communicate clearly and build rapport quickly',
        ],
      },
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          'Consistently booking qualified calls that convert to opportunities',
          'Building a pipeline of high quality prospects who are genuinely interested',
          'Mastering the discovery process and understanding client needs deeply',
          'Developing relationships that lead to long term business partnerships',
          'Contributing to team knowledge and helping improve our processes',
        ],
      },
      {
        title: 'Responsibilities',
        type: 'list',
        items: [
          'Prospect and identify service based businesses that fit our ideal client profile',
          'Conduct discovery conversations focused on understanding, not pitching',
          'Educate prospects on retention infrastructure and what outcomes are possible',
          'Qualify opportunities based on fit, not just interest (exclusivity matters)',
          'Maintain disciplined CRM hygiene and pipeline documentation',
          'Collaborate with closers to ensure smooth handoffs and context transfer',
        ],
      },
      {
        title: 'Requirements',
        type: 'list',
        items: [
          '0 to 2 years in sales, business development, or client facing roles',
          'Strong written and verbal communication skills',
          'Coachable mindset, eager to learn and implement feedback',
          'Comfort with outbound prospecting (cold email, LinkedIn, phone)',
          'Interest in B2B services, marketing technology, or business systems',
          'Self motivated with high personal accountability',
        ],
      },
    ],
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pag2MVTVHyntieliL/form',
    airtableHeight: '3500',
  },
  'closer': {
    title: 'Closer',
    subtitle: 'Sales',
    location: 'Remote',
    type: 'Full Time',
    description: 'As a Closer at Divine Acquisition, you\'ll be responsible for converting qualified opportunities into long term client partnerships. You understand that sales is about solving problems, not pushing products. You\'ll work with prospects who have already been qualified by our Setters, guiding them through the decision making process and helping them understand how our retention infrastructure can transform their business.',
    sections: [
      {
        title: 'Who This Is NOT For',
        type: 'list',
        items: [
          'High pressure salespeople who rely on manipulation tactics',
          'Those who view sales as a numbers game without caring about fit',
          'People who aren\'t willing to deeply understand client businesses',
          'Anyone who cuts corners or overpromises to close deals',
          'Those who can\'t handle a consultative, longer sales cycle',
        ],
      },
      {
        title: 'Who This IS For',
        type: 'list',
        items: [
          'Experienced sales professionals who genuinely care about client outcomes',
          'Strategic thinkers who can connect business problems to solutions',
          'Those who excel at building trust and long term relationships',
          'People who understand that the right deal matters more than any deal',
          'Individuals who can articulate complex value propositions simply',
        ],
      },
      {
        title: 'What Success Looks Like',
        type: 'list',
        items: [
          'Closing deals with clients who are genuinely the right fit',
          'Building a portfolio of successful, long term client relationships',
          'Maintaining high close rates on qualified opportunities',
          'Contributing to accurate forecasting and pipeline management',
          'Becoming a trusted advisor that clients refer others to',
        ],
      },
      {
        title: 'Responsibilities',
        type: 'list',
        items: [
          'Conduct consultative sales calls with qualified prospects',
          'Present our retention infrastructure solutions and demonstrate value',
          'Navigate complex decision making processes and handle objections',
          'Negotiate and close deals that are right for both parties',
          'Ensure smooth handoff to Client Success for onboarding',
          'Maintain accurate CRM records and pipeline forecasting',
        ],
      },
      {
        title: 'Requirements',
        type: 'list',
        items: [
          '3+ years of B2B sales experience, preferably in services or SaaS',
          'Proven track record of meeting or exceeding quota',
          'Experience with consultative or solution selling methodologies',
          'Strong presentation and negotiation skills',
          'Understanding of marketing, sales, and business operations',
          'Self motivated with excellent time management',
        ],
      },
    ],
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pag2MVTVHyntieliL/form',
    airtableHeight: '3500',
  },
  'media-buyer': {
    title: 'Media Buyer',
    subtitle: 'Growth',
    location: 'Remote',
    type: 'Full Time',
    description: 'As a Media Buyer at Divine Acquisition, you will architect paid acquisition systems that drive qualified pipeline for our clients. You\'ll build evidence based campaigns that compound results over time, working directly with clients to understand their ideal customer profile and create data driven advertising strategies that deliver predictable returns.',
    techStack: ['Meta Ads', 'Google Ads', 'TikTok Ads', 'Analytics', 'Tracking'],
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
        items: [
          'Architect and optimize paid media campaigns that integrate with our clients\' retention systems',
          'Build evidence based targeting strategies using data, not assumptions',
          'Manage and scale ad spend while maintaining or improving ROAS benchmarks',
          'Create systematic testing frameworks for creative, audiences, and landing pages',
          'Document and systematize winning campaign structures for repeatability',
          'Collaborate with our Systems team to ensure seamless lead flow into client CRMs',
        ],
      },
      {
        title: 'Requirements',
        type: 'list',
        items: [
          '3+ years managing paid media for service based or B2B businesses',
          'Proven track record managing $50K+ monthly ad spend profitably',
          'Deep expertise in Meta Ads Manager; Google Ads experience preferred',
          'Systems thinker. You build processes, not one off campaigns',
          'Strong analytical skills and comfort with data driven decision making',
          'Clear communicator who can translate performance data into client insights',
        ],
      },
    ],
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pagpc2PC375pTxiDS/form',
    airtableHeight: '3500',
  },
  'client-success': {
    title: 'Client Success Manager',
    subtitle: 'Client Success',
    location: 'Remote',
    type: 'Full Time',
    description: 'As a Client Success Manager at Divine Acquisition, you\'ll own the client relationship from onboarding to outcomes. You understand that we win only when the client wins. You\'ll be the trusted advisor who helps clients adopt our systems, interprets their data, and proactively identifies opportunities for growth.',
    sections: [
      {
        title: 'Responsibilities',
        type: 'list',
        items: [
          'Own the end to end client relationship from onboarding to retention',
          'Ensure clients successfully adopt and utilize our retention infrastructure',
          'Conduct regular business reviews focused on outcomes, not activity',
          'Proactively identify risks to client success and mobilize internal resources',
          'Translate complex system data into actionable insights for clients',
          'Collaborate with Systems and Growth teams to optimize client results',
        ],
      },
      {
        title: 'Requirements',
        type: 'list',
        items: [
          '3+ years in client success, account management, or consulting (B2B preferred)',
          'Track record of retaining and growing client relationships',
          'Strong understanding of CRM systems and marketing/sales infrastructure',
          'Excellent communication. You can explain complex systems simply',
          'Data literate: comfortable pulling insights from dashboards and reports',
          'High accountability. You own outcomes, not just activities',
        ],
      },
    ],
    airtableEmbed: 'https://airtable.com/embed/appI4kbEVdi5THUbs/pag7FzW7LYVFxnAuT/form',
    airtableHeight: '3500',
  },
};

export default function JobPage() {
  const params = useParams();
  const slug = params.slug as string;
  const job = jobs[slug];

  if (!job) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-medium mb-4">Position not found</h1>
          <Link href="/hiring" className="text-[#907DFF] hover:text-white transition-colors">
            ← Back to all positions
          </Link>
        </div>
      </div>
    );
  }

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
        {[...Array(30)].map((_, i) => (
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
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/hiring" className="group">
            <Image 
              src="/logo.png" 
              alt="Divine Acquisition" 
              width={120} 
              height={120}
              className="group-hover:opacity-80 transition-opacity"
            />
          </Link>
          
          <Link
            href="/hiring"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium
                       bg-white/5 border border-white/10 text-white
                       hover:bg-white/10 hover:border-white/20 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            All Positions
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-40 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          
          {/* Step 1: Role Description */}
          <section className="mb-20">
            <div className="flex items-center gap-4 mb-10">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#5500FF] to-[#907DFF] text-white text-sm font-bold shadow-lg shadow-[#5500FF]/30">
                1
              </div>
              <div>
                <span className="text-xs font-medium text-[#907DFF] uppercase tracking-widest">Step One</span>
                <h2 className="text-lg font-medium text-white">Review Position Details</h2>
              </div>
            </div>

            {/* Role Card */}
            <div className="relative p-8 md:p-10 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-sm overflow-hidden">
              {/* Card glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#5500FF]/10 blur-[100px] pointer-events-none" />
              
              <div className="relative">
                {/* Tags */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <span className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#5500FF] text-white shadow-lg shadow-[#5500FF]/30">
                    {job.subtitle}
                  </span>
                  <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-white/5 text-neutral-300 border border-white/10">
                    {job.location}
                  </span>
                  <span className="px-4 py-1.5 rounded-full text-xs font-medium bg-white/5 text-neutral-300 border border-white/10">
                    {job.type}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white tracking-tight mb-6">
                  {job.title}
                </h1>

                {/* Description */}
                <p className="text-lg text-neutral-400 font-light leading-relaxed mb-10">
                  {job.description}
                </p>

                {/* Tech Stack */}
                {job.techStack && (
                  <div className="mb-10">
                    <h3 className="text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-4">Tech Stack</h3>
                    <div className="flex flex-wrap gap-3">
                      {job.techStack.map((tech, index) => (
                        <span 
                          key={index}
                          className="px-4 py-2 rounded-xl text-sm font-medium bg-[#5500FF]/10 text-[#907DFF] border border-[#5500FF]/30"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sections */}
                <div className="space-y-10">
                  {job.sections.map((section, index) => (
                    <div key={index}>
                      <h3 className="text-xs font-semibold text-[#907DFF] uppercase tracking-widest mb-5 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#5500FF] shadow-lg shadow-[#5500FF]/50" />
                        {section.title}
                      </h3>
                      {section.type === 'list' && section.items && (
                        <ul className="space-y-4">
                          {section.items.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex items-start gap-4 text-neutral-300 font-light">
                              <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs text-[#907DFF] font-medium mt-0.5">
                                {itemIndex + 1}
                              </span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Step 2: Application Form */}
          <section id="apply">
            <div className="flex items-center gap-4 mb-10">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#5500FF] to-[#907DFF] text-white text-sm font-bold shadow-lg shadow-[#5500FF]/30">
                2
              </div>
              <div>
                <span className="text-xs font-medium text-[#907DFF] uppercase tracking-widest">Step Two</span>
                <h2 className="text-lg font-medium text-white">Submit Your Application</h2>
              </div>
            </div>

            <div className="relative rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-sm overflow-hidden">
              {/* Card glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#5500FF]/10 blur-[100px] pointer-events-none" />
              
              <div className="relative p-6 border-b border-white/5">
                <h3 className="text-xl font-semibold text-white mb-1">Apply for {job.title}</h3>
                <p className="text-sm text-neutral-500 font-light">Complete the form below to submit your application.</p>
              </div>
              <div className="relative">
                <iframe 
                  className="airtable-embed w-full"
                  src={job.airtableEmbed}
                  frameBorder="0"
                  width="100%"
                  height={job.airtableHeight}
                  style={{ 
                    background: 'transparent',
                    minHeight: `${job.airtableHeight}px`
                  }}
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <Link href="/hiring">
                <Image 
                  src="/logo.png" 
                  alt="Divine Acquisition" 
                  width={64} 
                  height={64}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                />
              </Link>
              <span className="text-neutral-600 text-sm font-light">
                © 2026 Divine Acquisition
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://instagram.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors">
                Instagram
              </a>
              <a href="https://x.com/@maliksannie" target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors">
                Twitter
              </a>
              <a href="https://divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-xs text-neutral-500 hover:text-[#907DFF] transition-colors">
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
