'use client';

import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/ad/rpc';
import { submitApplicationAction } from '@/lib/careers/actions';
import { btnPrimary } from './careers-ui';
import { SubmittingLine } from './agentic';

/**
 * The careers application. It submits to submit_role_application, so every
 * posting that uses it lands in the admin's Applicants inbox.
 */
export default function ApplicationForm({ roleSlug, jobTitle }: { roleSlug: string; jobTitle: string }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Vistrial's marketing field: a hairline, a white fill, a lavender focus ring.
  const field =
    'block w-full min-h-11 rounded-lg border border-c-line bg-c-card px-4 py-2.5 text-sm font-medium tracking-tight text-c-ink transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-c-muted/70 focus:border-[#9a88fc]/60 focus:shadow-[0_0_0_3px_rgba(154,136,252,0.18)] focus:outline-none';
  const label = 'mb-2 block text-sm font-medium text-c-ink';

  // Only shown once the application is actually on record. It used to be shown
  // after logging the form to the browser console and throwing it away.
  if (result?.ok) {
    return (
      <div className="live-enter px-6 py-14 text-center">
        <div className="relative mx-auto mb-6 flex size-16 items-center justify-center rounded-full border border-c-tint-line bg-c-card shadow-[0_0_0_4px_rgba(154,136,252,0.12),0_0_48px_-16px_rgba(154,136,252,0.9)]">
          <svg className="h-7 w-7 text-c-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
          <span aria-hidden className="live-pulse absolute -right-0.5 -top-0.5 size-3.5 rounded-full border-2 border-c-page bg-emerald-500" />
        </div>
        <h3 className="text-2xl font-medium tracking-tight text-c-ink">Application submitted</h3>
        <p className="mx-auto mt-3 max-w-md text-[length:15px] leading-relaxed text-c-muted">
          Thank you for applying for the {jobTitle} position. We&apos;ll review your application and get
          back to you within 5–7 business days.
        </p>
        <ol className="mx-auto mt-7 grid max-w-sm gap-2 text-left text-sm">
          <li className="flex items-center justify-between gap-2.5 rounded-lg border border-c-line bg-c-card px-3 py-2">
            <span className="text-c-ink">Received and on record</span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">Done</span>
          </li>
          <li className="flex items-center justify-between gap-2.5 rounded-lg border border-c-tint-line bg-c-tint px-3 py-2">
            <span className="live-shimmer-text text-c-ink">Waiting in the hiring inbox</span>
            <span className="rounded-full border border-c-tint-line bg-c-card px-2 py-0.5 text-[11px] font-medium text-c-violet">In progress</span>
          </li>
          <li className="flex items-center justify-between gap-2.5 rounded-lg border border-c-line bg-c-card px-3 py-2">
            <span className="text-c-muted">Read by a person</span>
            <span className="rounded-full border border-c-line px-2 py-0.5 text-[11px] font-medium text-c-muted">Next</span>
          </li>
        </ol>
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
            Full name
            <span className="text-c-violet"> *</span>
          </label>
          <input id="fullName" name="fullName" type="text" required className={field} placeholder="Jordan Rivera" />
        </div>
        <div>
          <label className={label} htmlFor="email">
            Email address
            <span className="text-c-violet"> *</span>
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
        <p className="mt-2 text-xs text-c-muted">
          Record a 2–3 minute video introducing yourself and why this role interests you.
        </p>
      </div>

      <div>
        <label className={label} htmlFor="experience">
          Relevant experience <span className="text-c-violet">*</span>
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
          Why are you the right fit? <span className="text-c-violet">*</span>
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
          Availability <span className="text-c-violet">*</span>
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
        <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-red-300">
          {result.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? <SubmittingLine>Sending your application</SubmittingLine> : 'Submit application'}
      </button>

      <p className="text-center text-xs text-c-muted">
        By submitting, you agree to our privacy policy and consent to being contacted about this
        opportunity.
      </p>
    </form>
  );
}

