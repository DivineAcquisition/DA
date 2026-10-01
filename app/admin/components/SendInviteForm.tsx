'use client';

import { useRef, useState, useTransition } from 'react';
import { btnPrimary, btnSizeMd } from '@/app/components/ui';
import { sendAssessmentInviteAction } from '@/lib/assessment/actions';

const field =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-neutral-600 transition-colors focus:border-brand-500/60 focus:bg-white/[0.05] focus:outline-none';
const label = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500';

export default function SendInviteForm() {
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
          const result = await sendAssessmentInviteAction(formData);
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
          <label className={label} htmlFor="fullName">
            Full name *
          </label>
          <input id="fullName" name="fullName" required className={field} placeholder="Alex Morgan" />
        </div>
        <div>
          <label className={label} htmlFor="email">
            Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className={field}
            placeholder="alex@company.com"
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="companyName">
          Company
        </label>
        <input id="companyName" name="companyName" className={field} placeholder="Acme Services" />
      </div>

      <div>
        <label className={label} htmlFor="note">
          Internal note
        </label>
        <textarea
          id="note"
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
        {pending ? 'Sending…' : 'Send assessment invite'}
      </button>
    </form>
  );
}
