'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

// Glowing dot component
function GlowDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-[#907DFF] opacity-75 animate-ping" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5500FF] shadow-[0_0_10px_3px_rgba(85,0,255,0.6)]" />
    </span>
  );
}

// Customization Form Component
function CustomizationForm() {
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    services: '',
    serviceAreas: '',
    pricingStructure: '',
    brandColors: '',
    depositAmount: '',
    reminderPreference: '',
    calendarIntegration: '',
    additionalNotes: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#5500FF]/20 flex items-center justify-center shadow-[0_0_30px_10px_rgba(85,0,255,0.3)]">
          <svg className="w-8 h-8 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-semibold text-white mb-3">Customization Request Submitted!</h3>
        <p className="text-neutral-400 font-light">
          Thank you! We&apos;ll review your information and reach out within 24-48 hours to discuss your custom booking interface.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
      {/* Company Information */}
      <div>
        <h3 className="text-sm font-semibold text-[#907DFF] uppercase tracking-wider mb-4">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Company Name *
            </label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
              placeholder="Sparkle Clean Co."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Contact Name *
            </label>
            <input
              type="text"
              required
              value={formData.contactName}
              onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
              placeholder="John Smith"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            Email Address *
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
            placeholder="john@sparkleclean.com"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
            placeholder="+1 (555) 000-0000"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
          Company Website
        </label>
        <input
          type="url"
          value={formData.website}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
          placeholder="https://sparkleclean.com"
        />
      </div>

      {/* Service Details */}
      <div className="pt-4">
        <h3 className="text-sm font-semibold text-[#907DFF] uppercase tracking-wider mb-4">Service Details</h3>
        
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Services Offered *
            </label>
            <textarea
              required
              rows={3}
              value={formData.services}
              onChange={(e) => setFormData({ ...formData, services: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all resize-none"
              placeholder="e.g., Standard Cleaning, Deep Cleaning, Move-in/Move-out, Office Cleaning, Post-Construction..."
            />
            <p className="mt-2 text-xs text-neutral-500">List all cleaning services you offer</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Service Areas *
            </label>
            <textarea
              required
              rows={2}
              value={formData.serviceAreas}
              onChange={(e) => setFormData({ ...formData, serviceAreas: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all resize-none"
              placeholder="e.g., Baltimore, MD and surrounding areas (25 mile radius)"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Pricing Structure *
            </label>
            <textarea
              required
              rows={3}
              value={formData.pricingStructure}
              onChange={(e) => setFormData({ ...formData, pricingStructure: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all resize-none"
              placeholder="e.g., Standard: $150-250, Deep Clean: $300-450, or hourly rates, square footage pricing..."
            />
            <p className="mt-2 text-xs text-neutral-500">Include pricing for each service type</p>
          </div>
        </div>
      </div>

      {/* Branding & Preferences */}
      <div className="pt-4">
        <h3 className="text-sm font-semibold text-[#907DFF] uppercase tracking-wider mb-4">Branding & Preferences</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Brand Colors
            </label>
            <input
              type="text"
              value={formData.brandColors}
              onChange={(e) => setFormData({ ...formData, brandColors: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
              placeholder="e.g., Blue (#0066CC), White, Green"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Deposit Amount
            </label>
            <input
              type="text"
              value={formData.depositAmount}
              onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
              placeholder="e.g., $50 or 25%"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div>
            <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Reminder Preference
            </label>
            <select
              value={formData.reminderPreference}
              onChange={(e) => setFormData({ ...formData, reminderPreference: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
            >
              <option value="" className="bg-[#0a0a0a]">Select preference</option>
              <option value="sms" className="bg-[#0a0a0a]">SMS Only</option>
              <option value="email" className="bg-[#0a0a0a]">Email Only</option>
              <option value="both" className="bg-[#0a0a0a]">Both SMS & Email</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Calendar Integration
            </label>
            <select
              value={formData.calendarIntegration}
              onChange={(e) => setFormData({ ...formData, calendarIntegration: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all"
            >
              <option value="" className="bg-[#0a0a0a]">Select calendar</option>
              <option value="google" className="bg-[#0a0a0a]">Google Calendar</option>
              <option value="outlook" className="bg-[#0a0a0a]">Outlook / Microsoft</option>
              <option value="apple" className="bg-[#0a0a0a]">Apple Calendar</option>
              <option value="other" className="bg-[#0a0a0a]">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Additional Notes */}
      <div className="pt-4">
        <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
          Additional Notes or Requirements
        </label>
        <textarea
          rows={4}
          value={formData.additionalNotes}
          onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#5500FF] focus:shadow-[0_0_15px_rgba(85,0,255,0.3)] transition-all resize-none"
          placeholder="Any specific features, integrations, or requirements you need..."
        />
      </div>

      <button
        type="submit"
        className="w-full py-4 rounded-xl bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white font-semibold hover:opacity-90 transition-opacity shadow-[0_0_30px_rgba(85,0,255,0.5)]"
      >
        Submit Customization Request
      </button>

      <p className="text-xs text-neutral-500 text-center font-light">
        We&apos;ll review your information and reach out within 24-48 hours to discuss your custom booking interface.
      </p>
    </form>
  );
}

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: 'Smart Calendar Sync',
    description: 'Automatically sync with Google Calendar, iCal, and Outlook. Never double-book or miss an appointment again.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    title: 'Automated Reminders',
    description: 'SMS and email reminders reduce no-shows by 80%. Keep your schedule full and your revenue growing.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    title: 'Instant Deposits',
    description: 'Collect deposits at booking to eliminate last-minute cancellations. Protect your time and revenue.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
    title: 'Real-Time Analytics',
    description: 'Track bookings, revenue, and customer behavior. Make data-driven decisions to grow your business.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Brand Customization',
    description: 'Match your brand colors, logo, and messaging. Create a seamless customer experience.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    title: 'Mobile Optimized',
    description: 'Your customers book from their phones. Our interface is designed mobile-first for the highest conversion.',
  },
];

const painPoints = [
  'Spending hours on the phone scheduling appointments',
  'Losing customers to competitors with online booking',
  'No-shows and last-minute cancellations eating into profits',
  'Double-bookings causing chaos and angry customers',
  'No way to collect deposits upfront',
  'Manual reminder calls wasting your valuable time',
];

export default function BookingInterfacePage() {
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
          className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-full md:w-[1400px] h-[900px] md:h-[1100px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(98,0,255,0.5) 0%, rgba(98,0,255,0.25) 30%, rgba(144,125,255,0.1) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute bottom-[-15%] right-[-5%] w-[700px] h-[700px] rounded-full opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(144,125,255,0.5) 0%, rgba(98,0,255,0.2) 50%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        <div 
          className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30"
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
          
          <a
            href="/booking-bcs"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_30px_rgba(85,0,255,0.5)]"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            Book Your Demo
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-32 pb-8 md:pt-40 md:pb-12">
        <div className="max-w-5xl mx-auto text-center">
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
            For Cleaning Companies Only
          </div>

          {/* Headline */}
          <h1 
            className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 leading-[1.1] text-transparent bg-clip-text
                        ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}
            style={{
              backgroundImage: 'linear-gradient(to right, white 0%, white 40%, #907DFF 70%, #5500FF 100%)',
            }}
          >
            Stop Losing Bookings To Your Competition
          </h1>

          {/* Subheadline */}
          <p 
            className={`text-xl md:text-2xl text-neutral-400 leading-relaxed font-light max-w-3xl mx-auto mb-10
                        ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}
          >
            Get a custom booking interface that converts website visitors into paying customers — 
            <span className="text-white font-medium"> automatically</span>.
          </p>

          {/* CTA Buttons */}
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 ${mounted ? 'animate-fade-in animation-delay-300' : 'opacity-0'}`}>
            <a
              href="/booking-bcs"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-lg font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_40px_rgba(85,0,255,0.6)] hover:shadow-[0_0_50px_rgba(85,0,255,0.8)]"
            >
              Watch The Demo
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </a>
            <a
              href="#customize"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-lg font-semibold bg-transparent border-2 border-[#5500FF] text-white hover:bg-[#5500FF]/10 transition-all"
            >
              Customize My Interface
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </a>
          </div>

          {/* Trust Badge */}
          <p className={`text-sm text-neutral-500 ${mounted ? 'animate-fade-in animation-delay-400' : 'opacity-0'}`}>
            Trusted by 50+ cleaning companies across the United States
          </p>
        </div>
      </section>

      {/* VSL Section */}
      <section className="relative z-10 px-6 py-12 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden bg-[#111111] border border-white/10 shadow-[0_0_60px_rgba(85,0,255,0.2)]">
            {/* Mac-style title bar */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-white/10 bg-[#0d0d0d]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-[0_0_8px_rgba(255,95,86,0.5)]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-[0_0_8px_rgba(255,189,46,0.5)]" />
                <span className="w-3 h-3 rounded-full bg-[#27C93F] shadow-[0_0_8px_rgba(39,201,63,0.5)]" />
              </div>
              <div className="flex items-center gap-2 text-neutral-400 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Watch how it works
              </div>
            </div>
            
            {/* Video Embed */}
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
              <iframe 
                src="https://www.loom.com/embed/83eefbba6a9d410799d4bac598934113" 
                frameBorder="0" 
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">The Problem</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              Sound Familiar?
            </h2>
            <p className="text-neutral-400 font-light text-lg">
              Most cleaning companies are losing money every single day because of these problems:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {painPoints.map((point, index) => (
              <div 
                key={index}
                className="flex items-start gap-4 p-5 rounded-xl bg-[#111111] border border-white/5 hover:border-red-500/20 transition-all group"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-neutral-300 font-light leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">The Solution</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              Your Custom Booking Interface
            </h2>
            <p className="text-neutral-400 font-light text-lg max-w-2xl mx-auto">
              Everything you need to automate your booking process and grow your cleaning business.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group p-6 rounded-2xl bg-[#111111] border border-white/10 hover:border-[#907DFF]/50 hover:shadow-[0_0_30px_rgba(144,125,255,0.15)] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-[#5500FF]/15 flex items-center justify-center text-[#907DFF] mb-5 group-hover:bg-[#5500FF]/25 group-hover:shadow-[0_0_20px_rgba(85,0,255,0.4)] transition-all">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#907DFF] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-neutral-400 font-light leading-relaxed text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Ad Traffic Section */}
      <section className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">For Ad Traffic</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              For Residential Home Service Companies
            </h2>
            <p className="text-neutral-400 font-light text-lg max-w-2xl mx-auto">
              Looking or planning on running ads? This booking interface is built to maximize your ROI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Optimized for Ad Traffic */}
            <div className="group p-6 rounded-2xl bg-gradient-to-br from-[#5500FF]/15 to-transparent border border-[#5500FF]/30 hover:border-[#907DFF]/60 hover:shadow-[0_0_40px_rgba(144,125,255,0.2)] transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-[#5500FF]/20 flex items-center justify-center text-[#907DFF] mb-4 group-hover:bg-[#5500FF]/30 group-hover:shadow-[0_0_20px_rgba(85,0,255,0.4)] transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Optimized for Ad Traffic
              </h3>
              <p className="text-neutral-400 font-light leading-relaxed text-sm">
                This booking interface works best when paired with your ad campaigns. Convert more clicks into booked appointments.
              </p>
            </div>

            {/* Proven Partner Results */}
            <div className="group p-6 rounded-2xl bg-gradient-to-br from-[#5500FF]/15 to-transparent border border-[#5500FF]/30 hover:border-[#907DFF]/60 hover:shadow-[0_0_40px_rgba(144,125,255,0.2)] transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-[#5500FF]/20 flex items-center justify-center text-[#907DFF] mb-4 group-hover:bg-[#5500FF]/30 group-hover:shadow-[0_0_20px_rgba(85,0,255,0.4)] transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Proven Partner Results
              </h3>
              <p className="text-neutral-400 font-light leading-relaxed text-sm">
                Our partners in residential cleaning secure more sales by implementing a custom booking experience tailored to their brand.
              </p>
            </div>

            {/* Built-in Retention Systems */}
            <div className="group p-6 rounded-2xl bg-gradient-to-br from-[#5500FF]/15 to-transparent border border-[#5500FF]/30 hover:border-[#907DFF]/60 hover:shadow-[0_0_40px_rgba(144,125,255,0.2)] transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-[#5500FF]/20 flex items-center justify-center text-[#907DFF] mb-4 group-hover:bg-[#5500FF]/30 group-hover:shadow-[0_0_20px_rgba(85,0,255,0.4)] transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Built-in Retention Systems
              </h3>
              <p className="text-neutral-400 font-light leading-relaxed text-sm">
                Includes client retention tools that prompt upsells and encourage recurring service subscriptions for maximum lifetime value.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Customize My Interface Section */}
      <section id="customize" className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">Get Started</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              Customize My Interface
            </h2>
            <p className="text-neutral-400 font-light text-lg max-w-2xl mx-auto">
              Tell us about your cleaning company and we&apos;ll build a custom booking interface tailored to your brand and services.
            </p>
          </div>

          <div className="relative rounded-2xl bg-[#111111] border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(85,0,255,0.1)]">
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[200px] bg-gradient-to-b from-[#5500FF]/10 to-transparent pointer-events-none" />
            
            {/* Mac-style title bar */}
            <div className="relative flex items-center gap-4 px-6 py-4 border-b border-white/10 bg-[#0d0d0d]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF5F56] shadow-[0_0_8px_rgba(255,95,86,0.5)]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E] shadow-[0_0_8px_rgba(255,189,46,0.5)]" />
                <span className="w-3 h-3 rounded-full bg-[#27C93F] shadow-[0_0_8px_rgba(39,201,63,0.5)]" />
              </div>
              <div className="flex items-center gap-3 flex-1">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5500FF] to-[#907DFF] flex items-center justify-center text-white shadow-[0_0_20px_rgba(85,0,255,0.4)]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Booking Interface Customization</h3>
                  <p className="text-xs text-neutral-500">Fill out the details below to get started</p>
                </div>
              </div>
            </div>
            
            {/* Form content */}
            <div className="relative">
              <CustomizationForm />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <GlowDot />
              <span className="text-xs font-semibold text-[#907DFF] uppercase tracking-[0.2em]">FAQ</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              Common Questions
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "How long does it take to set up?",
                a: "Most cleaning companies are up and running within 7 days. We handle all the technical setup — you just provide your branding and service details."
              },
              {
                q: "Do I need any technical skills?",
                a: "Not at all. We build everything for you and provide training on how to manage your bookings. If you can use Facebook, you can use this."
              },
              {
                q: "Will this work with my existing website?",
                a: "Yes! We can embed the booking widget on your existing website, or provide you with a standalone booking page if you prefer."
              },
              {
                q: "What if my customers don't book online?",
                a: "You can still manually add bookings for customers who call. But you'll be surprised — once you offer online booking, most customers prefer it."
              },
              {
                q: "Is there a contract or commitment?",
                a: "No long-term contracts. We're confident you'll love the results, so we don't lock you in."
              },
            ].map((faq, index) => (
              <div 
                key={index}
                className="p-6 rounded-xl bg-[#111111] border border-white/10"
              >
                <h3 className="text-white font-medium mb-2">{faq.q}</h3>
                <p className="text-neutral-400 font-light text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-6 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-6">
            Ready to Automate Your Bookings?
          </h2>
          <p className="text-neutral-400 font-light text-lg mb-8">
            Join the cleaning companies that are growing faster with automated booking.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/booking-bcs"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-lg font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_40px_rgba(85,0,255,0.6)] hover:shadow-[0_0_50px_rgba(85,0,255,0.8)]"
            >
              Book Your Demo Call
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
            <a
              href="#customize"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-lg font-semibold bg-transparent border-2 border-[#5500FF] text-white hover:bg-[#5500FF]/10 transition-all"
            >
              Customize My Interface
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </a>
          </div>
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
