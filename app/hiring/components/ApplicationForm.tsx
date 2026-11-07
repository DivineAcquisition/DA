'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/ad/rpc';
import { submitApplicationAction } from '@/lib/careers/actions';
import { hiringBtn, hiringBtnMd } from './visual';

/**
 * The careers application. It submits to submit_role_application, so every
 * posting that uses it lands in the admin's Applicants inbox.
 */
export default function ApplicationForm({ roleSlug, jobTitle }: { roleSlug: string; jobTitle: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const field =
    'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-neutral-600 transition-colors focus:border-brand-500/60 focus:bg-white/[0.05] focus:outline-none';
  const label = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500';

  // Only shown once the application is actually on record. It used to be shown
  // after logging the form to the browser console and throwing it away.
  if (result?.ok) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white">Application submitted</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
          Thank you for applying for the {jobTitle} position. We&apos;ll review your application and get
          back to you within 5–7 business days.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-5 p-5 sm:p-7"
      action={(formData) => {
        setResult(null);
        startTransition(async () => {
          setResult(await submitApplicationAction(roleSlug, jobTitle, formData));
        });
      }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className={label} htmlFor="fullName">
            Full name *
          </label>
          <input id="fullName" name="fullName" type="text" required className={field} placeholder="Jordan Rivera" />
        </div>
        <div>
          <label className={label} htmlFor="email">
            Email address *
          </label>
          <input id="email" name="email" type="email" required className={field} placeholder="you@example.com" />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className={label} htmlFor="phone">
            Phone number
          </label>
          <input id="phone" name="phone" type="tel" className={field} placeholder="+1 (555) 000-0000" />
        </div>
        <div>
          <label className={label} htmlFor="linkedin">
            LinkedIn profile
          </label>
          <input
            id="linkedin"
            name="linkedin"
            type="url"
            className={field}
            placeholder="https://linkedin.com/in/username"
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="portfolio">
          Portfolio / website
        </label>
        <input id="portfolio" name="portfolio" type="url" className={field} placeholder="https://yourportfolio.com" />
      </div>

      <div>
        <label className={label} htmlFor="loomVideo">
          Loom video introduction
        </label>
        <input
          id="loomVideo"
          name="loomVideo"
          type="url"
          className={field}
          placeholder="https://www.loom.com/share/your-video-id"
        />
        <p className="mt-2 text-xs text-neutral-600">
          Record a 2–3 minute video introducing yourself and why this role interests you.
        </p>
      </div>

      <div>
        <label className={label} htmlFor="experience">
          Relevant experience *
        </label>
        <textarea
          id="experience"
          name="experience"
          required
          rows={4}
          className={`${field} resize-none`}
          placeholder="Tell us about your relevant experience and accomplishments…"
        />
      </div>

      <div>
        <label className={label} htmlFor="whyYou">
          Why are you the right fit? *
        </label>
        <textarea
          id="whyYou"
          name="whyYou"
          required
          rows={4}
          className={`${field} resize-none`}
          placeholder="What makes you uniquely qualified for this role?"
        />
      </div>

      <div>
        <label className={label} htmlFor="availability">
          Availability *
        </label>
        <select
          id="availability"
          name="availability"
          required
          defaultValue=""
          className={`${field} cursor-pointer appearance-none`}
        >
          <option value="">Select availability</option>
          <option value="immediate">Immediately</option>
          <option value="1-2weeks">1–2 weeks</option>
          <option value="2-4weeks">2–4 weeks</option>
          <option value="1month+">1 month+</option>
        </select>
      </div>

      {result && !result.ok && (
        <p className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-4 py-3 text-sm leading-relaxed text-flag-critical">
          {result.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${hiringBtn} ${hiringBtnMd} w-full`}>
        {pending ? 'Submitting…' : 'Submit application'}
      </button>

      <p className="text-center text-xs text-neutral-600">
        By submitting, you agree to our privacy policy and consent to being contacted about this
        opportunity.
      </p>
    </form>
  );
}

