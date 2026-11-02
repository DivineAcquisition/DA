'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import TeamAuthDesk from '@/app/components/auth/TeamAuthDesk';
import type { PasswordResult } from '@/lib/auth/password';

/** Reached from a password reset email. */
export default function SetPasswordScreen({
  action,
}: {
  action: (formData: FormData) => Promise<PasswordResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [show, setShow] = useState(false);

  return (
    <TeamAuthDesk eyebrow="Account security" title="Set a new password" subtitle="Use at least 12 characters. You will continue into the app after it saves.">
      <form
        className="space-y-3.5"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await action(formData);
            if (result && !result.ok) setError(result.error);
          });
        }}
      >
        <div className="auth-field-block">
          <label className="auth-field-label" htmlFor="password">
            New password
          </label>
          <div className="auth-field">
            <Lock className="auth-field-icon" aria-hidden />
            <input
              id="password"
              name="password"
              type={show ? 'text' : 'password'}
              required
              minLength={12}
              autoComplete="new-password"
              className="auth-input auth-input--with-action"
            />
            <button type="button" className="auth-field-action" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((value) => !value)}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <div className="auth-field-block">
          <label className="auth-field-label" htmlFor="confirm">
            Type it again
          </label>
          <div className="auth-field">
            <Lock className="auth-field-icon" aria-hidden />
            <input id="confirm" name="confirm" type={show ? 'text' : 'password'} required minLength={12} autoComplete="new-password" className="auth-input" />
          </div>
        </div>
        {error ? (
          <p role="alert" className="auth-error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="auth-submit">
          {pending ? 'Saving…' : 'Save and continue'}
        </button>
      </form>
      <div className="mt-3">
        <a href="/workspace/forgot-password" className="auth-alt w-full">
          Send a new link
        </a>
      </div>
    </TeamAuthDesk>
  );
}
