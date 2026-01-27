'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type StepData = {
  // Step 0 - Business Info
  email: string;
  companyName: string;
  monthlyRevenue: string;
  // Step 1 - Missed Calls
  monthlyInboundCalls: string;
  missedCallPercentage: string;
  hasAfterHoursAnswering: string;
  // Step 2 - Lead Response
  avgResponseTime: string;
  hasAutomatedResponse: string;
  // Step 3 - Quote Follow-Up
  monthlyQuotes: string;
  closeRate: string;
  followUpTouches: string;
  hasAutomatedFollowUp: string;
  // Step 4 - No-Shows
  monthlyAppointments: string;
  noShowPercentage: string;
  hasReminderSystem: string;
  // Step 5 - Retention
  annualCustomers: string;
  repeatCustomerPercentage: string;
  hasRetentionSystem: string;
  // Step 6 - Reviews
  googleRating: string;
  monthlyReviews: string;
  respondsToReviews: string;
};

const initialData: StepData = {
  email: '',
  companyName: '',
  monthlyRevenue: '',
  monthlyInboundCalls: '',
  missedCallPercentage: '',
  hasAfterHoursAnswering: '',
  avgResponseTime: '',
  hasAutomatedResponse: '',
  monthlyQuotes: '',
  closeRate: '',
  followUpTouches: '',
  hasAutomatedFollowUp: '',
  monthlyAppointments: '',
  noShowPercentage: '',
  hasReminderSystem: '',
  annualCustomers: '',
  repeatCustomerPercentage: '',
  hasRetentionSystem: '',
  googleRating: '',
  monthlyReviews: '',
  respondsToReviews: '',
};

const steps = [
  { id: 0, title: "Business Info", icon: "🏢" },
  { id: 1, title: "Missed Calls", icon: "📞" },
  { id: 2, title: "Lead Response", icon: "⚡" },
  { id: 3, title: "Quote Follow-Up", icon: "📋" },
  { id: 4, title: "No-Shows", icon: "📅" },
  { id: 5, title: "Retention", icon: "🔄" },
  { id: 6, title: "Reviews", icon: "⭐" },
];

export default function LeakageAuditPage() {
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<StepData>(initialData);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{
    missedCallsLeakage: number;
    leadResponseLeakage: number;
    quoteFollowUpLeakage: number;
    noShowLeakage: number;
    retentionLeakage: number;
    reviewLeakage: number;
    totalLeakage: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateField = (field: keyof StepData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateResults = () => {
    const monthlyRevenue = parseFloat(formData.monthlyRevenue) || 0;
    const avgJobValue = monthlyRevenue / (parseFloat(formData.monthlyQuotes) || 1);
    
    // Missed Calls Leakage: 27% of calls missed × 85% never call back × potential job value
    const missedCalls = (parseFloat(formData.monthlyInboundCalls) || 0) * (parseFloat(formData.missedCallPercentage) || 0) / 100;
    const lostFromMissedCalls = missedCalls * 0.85;
    const missedCallsLeakage = lostFromMissedCalls * avgJobValue * 0.3 * 12; // 30% would have converted
    
    // Lead Response Leakage: Slow response = lost leads
    const responseMultiplier = formData.avgResponseTime === '5min' ? 0 : 
                               formData.avgResponseTime === '1hour' ? 0.4 :
                               formData.avgResponseTime === 'sameday' ? 0.6 : 0.8;
    const leadResponseLeakage = monthlyRevenue * responseMultiplier * 0.15 * 12;
    
    // Quote Follow-Up Leakage
    const quotes = parseFloat(formData.monthlyQuotes) || 0;
    const currentCloseRate = (parseFloat(formData.closeRate) || 0) / 100;
    const potentialCloseRate = Math.min(currentCloseRate + 0.15, 0.6);
    const quoteFollowUpLeakage = quotes * (potentialCloseRate - currentCloseRate) * avgJobValue * 12;
    
    // No-Show Leakage
    const appointments = parseFloat(formData.monthlyAppointments) || 0;
    const noShowRate = (parseFloat(formData.noShowPercentage) || 0) / 100;
    const noShowLeakage = appointments * noShowRate * avgJobValue * 0.5 * 12;
    
    // Retention Leakage
    const customers = parseFloat(formData.annualCustomers) || 0;
    const repeatRate = (parseFloat(formData.repeatCustomerPercentage) || 0) / 100;
    const potentialRepeatRate = Math.min(repeatRate + 0.2, 0.5);
    const retentionLeakage = customers * (potentialRepeatRate - repeatRate) * avgJobValue * 2;
    
    // Review Leakage (reputation impact)
    const rating = parseFloat(formData.googleRating) || 4;
    const ratingImpact = rating < 4.5 ? (4.5 - rating) * 0.1 : 0;
    const reviewLeakage = monthlyRevenue * ratingImpact * 12;
    
    const totalLeakage = missedCallsLeakage + leadResponseLeakage + quoteFollowUpLeakage + noShowLeakage + retentionLeakage + reviewLeakage;
    
    setResults({
      missedCallsLeakage: Math.round(missedCallsLeakage),
      leadResponseLeakage: Math.round(leadResponseLeakage),
      quoteFollowUpLeakage: Math.round(quoteFollowUpLeakage),
      noShowLeakage: Math.round(noShowLeakage),
      retentionLeakage: Math.round(retentionLeakage),
      reviewLeakage: Math.round(reviewLeakage),
      totalLeakage: Math.round(totalLeakage),
    });
    setShowResults(true);
  };

  const nextStep = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    } else {
      calculateResults();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">Let&apos;s Start With Your Business</h2>
              <p className="text-neutral-400 font-light">We need some basic info to calculate your revenue leakage.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Company Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="ABC Plumbing"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Average Monthly Revenue</label>
              <input
                type="number"
                value={formData.monthlyRevenue}
                onChange={(e) => updateField('monthlyRevenue', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="50000"
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">Missed Calls Assessment</h2>
              <p className="text-neutral-400 font-light">27% of calls go unanswered. 85% of those callers never call back.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">How many inbound calls do you get per month?</label>
              <input
                type="number"
                value={formData.monthlyInboundCalls}
                onChange={(e) => updateField('monthlyInboundCalls', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">What % of calls do you estimate you miss?</label>
              <input
                type="number"
                value={formData.missedCallPercentage}
                onChange={(e) => updateField('missedCallPercentage', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Do you have after-hours call answering?</label>
              <div className="flex gap-4">
                {['Yes', 'No'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateField('hasAfterHoursAnswering', option.toLowerCase())}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.hasAfterHoursAnswering === option.toLowerCase()
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">Lead Response Time</h2>
              <p className="text-neutral-400 font-light">Leads contacted within 5 minutes are 21x more likely to convert.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Average time to respond to new leads?</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: '5min', label: 'Under 5 min' },
                  { value: '1hour', label: 'Within 1 hour' },
                  { value: 'sameday', label: 'Same day' },
                  { value: 'nextday', label: 'Next day+' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField('avgResponseTime', option.value)}
                    className={`px-5 py-4 rounded-xl border transition-all ${
                      formData.avgResponseTime === option.value
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Do you have automated instant response for new leads?</label>
              <div className="flex gap-4">
                {['Yes', 'No'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateField('hasAutomatedResponse', option.toLowerCase())}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.hasAutomatedResponse === option.toLowerCase()
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">Quote Follow-Up</h2>
              <p className="text-neutral-400 font-light">80% of sales require 5-12 follow-up contacts. 48% of salespeople never follow up.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">How many quotes do you send per month?</label>
              <input
                type="number"
                value={formData.monthlyQuotes}
                onChange={(e) => updateField('monthlyQuotes', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">What&apos;s your current close rate? (%)</label>
              <input
                type="number"
                value={formData.closeRate}
                onChange={(e) => updateField('closeRate', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">How many follow-up touches do you do?</label>
              <input
                type="number"
                value={formData.followUpTouches}
                onChange={(e) => updateField('followUpTouches', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Do you have automated follow-up?</label>
              <div className="flex gap-4">
                {['Yes', 'No'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateField('hasAutomatedFollowUp', option.toLowerCase())}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.hasAutomatedFollowUp === option.toLowerCase()
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">Appointment No-Shows</h2>
              <p className="text-neutral-400 font-light">No-shows waste time and cost you revenue.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Monthly appointments</label>
              <input
                type="number"
                value={formData.monthlyAppointments}
                onChange={(e) => updateField('monthlyAppointments', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="80"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">No-show percentage (%)</label>
              <input
                type="number"
                value={formData.noShowPercentage}
                onChange={(e) => updateField('noShowPercentage', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Do you have a reminder system?</label>
              <div className="flex gap-4">
                {['Yes', 'No'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateField('hasReminderSystem', option.toLowerCase())}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.hasReminderSystem === option.toLowerCase()
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">Customer Retention</h2>
              <p className="text-neutral-400 font-light">Acquiring a new customer costs 5x more than retaining an existing one.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Annual customers</label>
              <input
                type="number"
                value={formData.annualCustomers}
                onChange={(e) => updateField('annualCustomers', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Repeat customer percentage (%)</label>
              <input
                type="number"
                value={formData.repeatCustomerPercentage}
                onChange={(e) => updateField('repeatCustomerPercentage', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Do you have a retention system?</label>
              <div className="flex gap-4">
                {['Yes', 'No'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateField('hasRetentionSystem', option.toLowerCase())}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.hasRetentionSystem === option.toLowerCase()
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">Reviews & Reputation</h2>
              <p className="text-neutral-400 font-light">Reviews directly impact your ability to win new customers.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Current Google rating</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={formData.googleRating}
                onChange={(e) => updateField('googleRating', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="4.2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Monthly reviews received</label>
              <input
                type="number"
                value={formData.monthlyReviews}
                onChange={(e) => updateField('monthlyReviews', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Do you respond to reviews?</label>
              <div className="flex gap-4">
                {['Yes', 'No'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateField('respondsToReviews', option.toLowerCase())}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.respondsToReviews === option.toLowerCase()
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderResults = () => {
    if (!results) return null;

    const leakageCategories = [
      { label: 'Missed Calls', value: results.missedCallsLeakage, color: 'red' },
      { label: 'Slow Lead Response', value: results.leadResponseLeakage, color: 'orange' },
      { label: 'Quote Follow-Up', value: results.quoteFollowUpLeakage, color: 'yellow' },
      { label: 'No-Shows', value: results.noShowLeakage, color: 'purple' },
      { label: 'Poor Retention', value: results.retentionLeakage, color: 'blue' },
      { label: 'Reviews/Reputation', value: results.reviewLeakage, color: 'cyan' },
    ];

    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">Your Revenue Leakage Report</h2>
          <p className="text-neutral-400 font-light">Here&apos;s where you&apos;re losing money — and how much.</p>
        </div>

        {/* Total Leakage */}
        <div className="relative p-8 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/30 text-center">
          <p className="text-sm text-red-400 mb-2">Estimated Annual Revenue Leakage</p>
          <p className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text" style={{
            backgroundImage: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
          }}>
            {formatCurrency(results.totalLeakage)}
          </p>
          <p className="text-neutral-500 text-sm mt-2">per year in lost revenue</p>
        </div>

        {/* Breakdown */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Breakdown by Category</h3>
          {leakageCategories.map((category, index) => (
            <div key={index} className="relative p-4 rounded-xl bg-[#111111]/80 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">{category.label}</span>
                <span className="text-lg font-semibold text-red-400">{formatCurrency(category.value)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500"
                  style={{ width: `${Math.min((category.value / results.totalLeakage) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="relative p-8 rounded-2xl bg-gradient-to-br from-[#111111] to-[#0d0d0d] border border-[#907DFF]/40 shadow-[0_0_60px_rgba(144,125,255,0.1)] text-center">
          <h3 className="text-xl font-semibold text-white mb-3">Ready to Plug These Leaks?</h3>
          <p className="text-neutral-400 font-light mb-6">
            Book a strategy call and we&apos;ll show you exactly how to recover this revenue.
          </p>
          <Link
            href="/booking-bcs"
            className="group inline-flex items-center gap-3 px-8 py-4 rounded-full text-base font-semibold bg-gradient-to-r from-[#5500FF] via-[#6200FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_40px_rgba(85,0,255,0.5)] hover:shadow-[0_0_60px_rgba(85,0,255,0.7)]"
          >
            Book Your Strategy Call
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    );
  };

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
          className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-full md:w-[1400px] h-[900px]"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(144,125,255,0.25) 0%, rgba(98,0,255,0.1) 40%, transparent 70%)',
            filter: 'blur(80px)',
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
        </div>
      </nav>

      {/* Main Content */}
      <section className="relative z-10 px-6 pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="max-w-2xl mx-auto">
          {!showResults ? (
            <>
              {/* Header */}
              <div className={`text-center mb-10 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#907DFF] bg-[#907DFF]/10 border border-[#907DFF]/30 mb-6">
                  <span>📊</span> Revenue Leakage Audit
                </div>
                <h1 className="text-3xl md:text-4xl font-semibold text-white mb-3">
                  Find Where You&apos;re Losing Revenue
                </h1>
                <p className="text-neutral-400 font-light">
                  Answer a few questions to calculate your exact revenue leakage.
                </p>
              </div>

              {/* Progress Bar */}
              <div className={`mb-8 ${mounted ? 'animate-fade-in animation-delay-100' : 'opacity-0'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-neutral-400">Step {currentStep + 1} of 7</span>
                  <span className="text-sm text-neutral-400">{steps[currentStep].icon} {steps[currentStep].title}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-[#5500FF] to-[#907DFF] transition-all duration-500"
                    style={{ width: `${((currentStep + 1) / 7) * 100}%` }}
                  />
                </div>
              </div>

              {/* Form Card */}
              <div className={`relative p-8 md:p-10 rounded-2xl bg-[#111111]/80 border border-white/10 ${mounted ? 'animate-fade-in animation-delay-200' : 'opacity-0'}`}>
                {renderStepContent()}
                
                {/* Navigation Buttons */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
                  <button
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className="px-6 py-3 rounded-xl text-sm font-medium text-neutral-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={nextStep}
                    className="group px-8 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_20px_rgba(85,0,255,0.3)]"
                  >
                    {currentStep === 6 ? 'Calculate My Leakage' : 'Continue'}
                    <svg className="inline-block w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className={mounted ? 'animate-fade-in' : 'opacity-0'}>
              {renderResults()}
            </div>
          )}
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
              <a href="https://hiring.divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
