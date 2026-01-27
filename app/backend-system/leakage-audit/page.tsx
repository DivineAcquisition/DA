'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type AuditData = {
  // Step 0 - Business Info
  email: string;
  company_name: string;
  monthly_revenue: number;
  // Step 1 - Missed Calls
  monthly_calls: number;
  missed_call_percentage: number;
  has_after_hours_answering: boolean;
  // Step 2 - Lead Response
  avg_response_time_minutes: number;
  has_automated_response: boolean;
  // Step 3 - Quote Follow-Up
  monthly_quotes: number;
  current_close_rate: number;
  follow_up_touches: number;
  has_automated_follow_up: boolean;
  // Step 4 - No-Shows
  monthly_appointments: number;
  no_show_percentage: number;
  has_reminder_system: boolean;
  // Step 5 - Retention
  annual_customers: number;
  repeat_customer_percentage: number;
  has_retention_system: boolean;
  // Step 6 - Reviews
  current_google_rating: number;
  monthly_reviews: number;
  responds_to_reviews: boolean;
};

type LeakageResults = {
  missed_calls_leakage: number;
  response_time_leakage: number;
  quote_followup_leakage: number;
  no_show_leakage: number;
  retention_leakage: number;
  review_opportunity: number;
  total_annual_leakage: number;
};

const initialData: AuditData = {
  email: '',
  company_name: '',
  monthly_revenue: 50000,
  monthly_calls: 200,
  missed_call_percentage: 27,
  has_after_hours_answering: false,
  avg_response_time_minutes: 60,
  has_automated_response: false,
  monthly_quotes: 50,
  current_close_rate: 20,
  follow_up_touches: 1,
  has_automated_follow_up: false,
  monthly_appointments: 80,
  no_show_percentage: 25,
  has_reminder_system: false,
  annual_customers: 500,
  repeat_customer_percentage: 15,
  has_retention_system: false,
  current_google_rating: 4.0,
  monthly_reviews: 2,
  responds_to_reviews: false,
};

const steps = [
  { id: 0, title: "Business Info", icon: "building" },
  { id: 1, title: "Missed Calls", icon: "phone" },
  { id: 2, title: "Lead Response", icon: "bolt" },
  { id: 3, title: "Quote Follow-Up", icon: "clipboard" },
  { id: 4, title: "No-Shows", icon: "calendar" },
  { id: 5, title: "Retention", icon: "refresh" },
  { id: 6, title: "Reviews", icon: "star" },
];

const StepIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'building':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
      );
    case 'phone':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
        </svg>
      );
    case 'bolt':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      );
    case 'clipboard':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      );
    case 'refresh':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      );
    case 'star':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      );
    default:
      return null;
  }
};

export default function LeakageAuditPage() {
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<AuditData>(initialData);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<LeakageResults | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateField = <K extends keyof AuditData>(field: K, value: AuditData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const calculateResults = () => {
    // Average Job Value
    const avgJobValue = formData.monthly_revenue / formData.monthly_appointments;

    // Missed Calls Leakage
    const missedCalls = (formData.monthly_calls * formData.missed_call_percentage) / 100;
    const lostOpportunities = missedCalls * 0.85; // 85% won't call back
    const missed_calls_leakage = lostOpportunities * avgJobValue * 12;

    // Response Time Leakage (conversion drops 80% after 5 minutes)
    let responseMultiplier = 1;
    if (formData.avg_response_time_minutes < 5) responseMultiplier = 1;
    else if (formData.avg_response_time_minutes <= 30) responseMultiplier = 0.2;
    else if (formData.avg_response_time_minutes <= 60) responseMultiplier = 0.1;
    else responseMultiplier = 0.05;
    
    const potentialLeadsLost = formData.monthly_calls * (1 - responseMultiplier) * 0.3;
    const response_time_leakage = potentialLeadsLost * avgJobValue * 12;

    // Quote Follow-Up Leakage
    const currentCloses = (formData.monthly_quotes * formData.current_close_rate) / 100;
    const potentialCloseRate = Math.min(40, formData.current_close_rate + (7 - formData.follow_up_touches) * 3);
    const potentialCloses = (formData.monthly_quotes * potentialCloseRate) / 100;
    const quote_followup_leakage = (potentialCloses - currentCloses) * avgJobValue * 12;

    // No-Show Leakage
    const noShows = (formData.monthly_appointments * formData.no_show_percentage) / 100;
    const recoverableNoShows = formData.has_reminder_system ? noShows * 0.1 : noShows * 0.9;
    const no_show_leakage = recoverableNoShows * avgJobValue * 12;

    // Retention Leakage
    const currentRepeat = (formData.annual_customers * formData.repeat_customer_percentage) / 100;
    const potentialRepeat = formData.annual_customers * 0.45; // 45% with system
    const retention_leakage = (potentialRepeat - currentRepeat) * avgJobValue;

    // Review Opportunity
    const ratingGap = 4.8 - formData.current_google_rating;
    const reviewPenalty = formData.responds_to_reviews ? 0 : formData.monthly_revenue * 12 * 0.02;
    const review_opportunity = (ratingGap * 0.07 * formData.monthly_revenue * 12) + reviewPenalty;

    const total_annual_leakage = missed_calls_leakage + response_time_leakage + quote_followup_leakage + no_show_leakage + retention_leakage + review_opportunity;

    setResults({
      missed_calls_leakage: Math.round(Math.max(0, missed_calls_leakage)),
      response_time_leakage: Math.round(Math.max(0, response_time_leakage)),
      quote_followup_leakage: Math.round(Math.max(0, quote_followup_leakage)),
      no_show_leakage: Math.round(Math.max(0, no_show_leakage)),
      retention_leakage: Math.round(Math.max(0, retention_leakage)),
      review_opportunity: Math.round(Math.max(0, review_opportunity)),
      total_annual_leakage: Math.round(Math.max(0, total_annual_leakage)),
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
                value={formData.company_name}
                onChange={(e) => updateField('company_name', e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="ABC Plumbing"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Average Monthly Revenue ($)</label>
              <input
                type="number"
                value={formData.monthly_revenue}
                onChange={(e) => updateField('monthly_revenue', parseInt(e.target.value) || 0)}
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
                value={formData.monthly_calls}
                onChange={(e) => updateField('monthly_calls', parseInt(e.target.value) || 0)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">What % of calls do you estimate you miss?</label>
              <input
                type="number"
                value={formData.missed_call_percentage}
                onChange={(e) => updateField('missed_call_percentage', parseInt(e.target.value) || 0)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="27"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Do you have after-hours call answering?</label>
              <div className="flex gap-4">
                {[true, false].map((option) => (
                  <button
                    key={option.toString()}
                    type="button"
                    onClick={() => updateField('has_after_hours_answering', option)}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.has_after_hours_answering === option
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option ? 'Yes' : 'No'}
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
              <label className="block text-sm font-medium text-neutral-300 mb-2">Average time to respond to new leads (minutes)?</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 5, label: 'Under 5 min' },
                  { value: 30, label: '5-30 min' },
                  { value: 60, label: '30-60 min' },
                  { value: 120, label: '60+ min' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField('avg_response_time_minutes', option.value)}
                    className={`px-5 py-4 rounded-xl border transition-all ${
                      formData.avg_response_time_minutes === option.value
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
                {[true, false].map((option) => (
                  <button
                    key={option.toString()}
                    type="button"
                    onClick={() => updateField('has_automated_response', option)}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.has_automated_response === option
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option ? 'Yes' : 'No'}
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
                value={formData.monthly_quotes}
                onChange={(e) => updateField('monthly_quotes', parseInt(e.target.value) || 0)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">What&apos;s your current close rate? (%)</label>
              <input
                type="number"
                value={formData.current_close_rate}
                onChange={(e) => updateField('current_close_rate', parseInt(e.target.value) || 0)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">How many follow-up touches do you do?</label>
              <input
                type="number"
                value={formData.follow_up_touches}
                onChange={(e) => updateField('follow_up_touches', parseInt(e.target.value) || 0)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Do you have automated follow-up?</label>
              <div className="flex gap-4">
                {[true, false].map((option) => (
                  <button
                    key={option.toString()}
                    type="button"
                    onClick={() => updateField('has_automated_follow_up', option)}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.has_automated_follow_up === option
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option ? 'Yes' : 'No'}
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
                value={formData.monthly_appointments}
                onChange={(e) => updateField('monthly_appointments', parseInt(e.target.value) || 0)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="80"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">No-show percentage (%)</label>
              <input
                type="number"
                value={formData.no_show_percentage}
                onChange={(e) => updateField('no_show_percentage', parseInt(e.target.value) || 0)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="25"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Do you have a reminder system?</label>
              <div className="flex gap-4">
                {[true, false].map((option) => (
                  <button
                    key={option.toString()}
                    type="button"
                    onClick={() => updateField('has_reminder_system', option)}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.has_reminder_system === option
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option ? 'Yes' : 'No'}
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
                value={formData.annual_customers}
                onChange={(e) => updateField('annual_customers', parseInt(e.target.value) || 0)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Repeat customer percentage (%)</label>
              <input
                type="number"
                value={formData.repeat_customer_percentage}
                onChange={(e) => updateField('repeat_customer_percentage', parseInt(e.target.value) || 0)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Do you have a retention system?</label>
              <div className="flex gap-4">
                {[true, false].map((option) => (
                  <button
                    key={option.toString()}
                    type="button"
                    onClick={() => updateField('has_retention_system', option)}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.has_retention_system === option
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option ? 'Yes' : 'No'}
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
                value={formData.current_google_rating}
                onChange={(e) => updateField('current_google_rating', parseFloat(e.target.value) || 0)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="4.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Monthly reviews received</label>
              <input
                type="number"
                value={formData.monthly_reviews}
                onChange={(e) => updateField('monthly_reviews', parseInt(e.target.value) || 0)}
                className="w-full px-5 py-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#907DFF]/50 transition-all"
                placeholder="2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Do you respond to reviews?</label>
              <div className="flex gap-4">
                {[true, false].map((option) => (
                  <button
                    key={option.toString()}
                    type="button"
                    onClick={() => updateField('responds_to_reviews', option)}
                    className={`flex-1 px-5 py-4 rounded-xl border transition-all ${
                      formData.responds_to_reviews === option
                        ? 'bg-[#907DFF]/20 border-[#907DFF]/50 text-white'
                        : 'bg-[#0a0a0a] border-white/10 text-neutral-400 hover:border-white/20'
                    }`}
                  >
                    {option ? 'Yes' : 'No'}
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
      { label: 'Missed Calls', value: results.missed_calls_leakage },
      { label: 'Slow Lead Response', value: results.response_time_leakage },
      { label: 'Quote Follow-Up', value: results.quote_followup_leakage },
      { label: 'No-Shows', value: results.no_show_leakage },
      { label: 'Poor Retention', value: results.retention_leakage },
      { label: 'Reviews/Reputation', value: results.review_opportunity },
    ];

    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">Your Revenue Leakage Report</h2>
          <p className="text-neutral-400 font-light">Here&apos;s where you&apos;re losing money — and how much.</p>
        </div>

        {/* Total Leakage */}
        <div className="relative p-8 rounded-2xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/30 text-center">
          <p className="text-sm text-red-400 mb-2 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Estimated Annual Revenue Leakage
          </p>
          <p className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text" style={{
            backgroundImage: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
          }}>
            {formatCurrency(results.total_annual_leakage)}
          </p>
          <p className="text-neutral-500 text-sm mt-2">per year in lost revenue</p>
        </div>

        {/* Breakdown */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-[#907DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
            </svg>
            Breakdown by Category
          </h3>
          {leakageCategories.map((category, index) => (
            <div key={index} className="relative p-4 rounded-xl bg-[#111111]/80 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">{category.label}</span>
                <span className="text-lg font-semibold text-red-400">{formatCurrency(category.value)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500"
                  style={{ width: `${Math.min((category.value / results.total_annual_leakage) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Calendar CTA */}
        <div className="relative p-8 rounded-2xl bg-gradient-to-br from-[#111111] to-[#0d0d0d] border border-[#907DFF]/40 shadow-[0_0_60px_rgba(144,125,255,0.1)]">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-white mb-3">Ready to Plug These Leaks?</h3>
            <p className="text-neutral-400 font-light">
              Book a strategy call and we&apos;ll show you exactly how to recover this revenue.
            </p>
          </div>
          {/* MsgSndr Booking Calendar */}
          <div className="rounded-xl overflow-hidden">
            <iframe
              src="https://link.msgsndr.divineacquisition.io/widget/booking/8HRU6QplAvtDfVINjDbk"
              style={{ width: '100%', border: 'none', overflow: 'hidden', minHeight: '700px' }}
              scrolling="no"
            />
          </div>
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
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  Revenue Leakage Audit
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
                  <span className="text-sm text-neutral-400 flex items-center gap-2">
                    <StepIcon type={steps[currentStep].icon} />
                    {steps[currentStep].title}
                  </span>
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
                    className="px-6 py-3 rounded-xl text-sm font-medium text-neutral-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Back
                  </button>
                  <button
                    onClick={nextStep}
                    className="group px-8 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#5500FF] to-[#907DFF] text-white hover:opacity-90 transition-all shadow-[0_0_20px_rgba(85,0,255,0.3)] flex items-center gap-2"
                  >
                    {currentStep === 6 ? 'Calculate My Leakage' : 'Continue'}
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
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
              <a href="https://go.divineacquisition.io/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[10px] text-neutral-400 font-medium hover:text-[#907DFF] transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
