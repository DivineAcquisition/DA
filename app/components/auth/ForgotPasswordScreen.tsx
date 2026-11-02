'use client';

import { useState, useTransition } from 'react';
import { Mail } from 'lucide-react';
import TeamAuthDesk from '@/app/components/auth/TeamAuthDesk';
import type { PasswordResult } from '@/lib/auth/password';

/** Forgot-password page for every sign-in, on the same desk as the team app. */
export default function ForgotPasswordScreen({
  action,
  backHref,
  linkExpired = false,
}: {
  action: (formData: FormData) => Promise<PasswordResult>;
  backHref: string;
  linkExpired?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <TeamAuthDesk eyebrow="Account" title="Check your email" subtitle="If that address has an account, a link to set a new password is on its way.">
        <a href={backHref} className="auth-alt w-full">
          Back to sign in
        </a>
      </TeamAuthDesk>
    );
  }

  return (
    <TeamAuthDesk
      eyebrow="Account"
      title="Forgot your password?"
      subtitle={
        linkExpired
          ? 'That link has expired. Enter the email you sign in with and we will send a new one.'
          : 'Enter the email you sign in with. We will send a link to set a new password.'
      }
    >
      <form
        className="space-y-3.5"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await action(formData);
            if (result.ok) setSent(true);
            else setError(result.error);
          });
        }}
      >
        <div className="auth-field-block">
          <label className="auth-field-label" htmlFor="email">
            Email
          </label>
          <div className="auth-field">
            <Mail className="auth-field-icon" aria-hidden />
            <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" className="auth-input" />
          </div>
        </div>
        {error ? (
          <p role="alert" className="auth-error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="auth-submit">
          {pending ? 'Sending…' : 'Send the link'}
        </button>
      </form>
      <div className="mt-3">
        <a href={backHref} className="auth-alt w-full">
          Back to sign in
        </a>
      </div>
    </TeamAuthDesk>
  );
}
