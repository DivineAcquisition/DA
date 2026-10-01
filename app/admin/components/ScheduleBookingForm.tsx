'use client';

import { useRef, useState, useTransition } from 'react';
import { btnPrimary, btnSizeMd } from '@/app/components/ui';
import { scheduleAssessmentBookingAction } from '@/lib/assessment/actions';

const field =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-neutral-600 transition-colors focus:border-brand-500/60 focus:bg-white/[0.05] focus:outline-none';
const label = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500';

const TIME_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'UTC',
];

export default function ScheduleBookingForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="space-y-5"
      action={(formData) => {
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await scheduleAssessmentBookingAction(formData);
          if (result.ok) {
            setMessage(result.message);
            formRef.current?.reset();
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="scheduleFullName">
            Full name *
          </label>
          <input
            id="scheduleFullName"
            name="fullName"
            required
            className={field}
            placeholder="Alex Morgan"
          />
        </div>
        <div>
          <label className={label} htmlFor="scheduleEmail">
            Email *
          </label>
          <input
            id="scheduleEmail"
            name="email"
            type="email"
            required
            className={field}
            placeholder="alex@company.com"
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="scheduleCompany">
          Company
        </label>
        <input id="scheduleCompany" name="companyName" className={field} placeholder="Acme Services" />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className={label} htmlFor="startsAtLocal">
            Date &amp; time *
          </label>
          <input id="startsAtLocal" name="startsAtLocal" type="datetime-local" required className={field} />
        </div>
        <div>
          <label className={label} htmlFor="timeZone">
            Time zone *
          </label>
          <select id="timeZone" name="timeZone" required className={field} defaultValue="America/New_York">
            {TIME_ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="durationMinutes">
            Duration
          </label>
          <select id="durationMinutes" name="durationMinutes" className={field} defaultValue="30">
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="scheduleNote">
          Internal note
        </label>
        <textarea
          id="scheduleNote"
          name="note"
          rows={3}
          className={`${field} resize-y`}
          placeholder="Optional context for the pipeline"
        />
      </div>

      {message && (
        <p className="rounded-xl border border-flag-good/25 bg-flag-good/[0.08] px-3.5 py-2.5 text-sm text-flag-good">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeMd}`}>
        {pending ? 'Scheduling…' : 'Create booking + send confirmation'}
      </button>
    </form>
  );
}
