'use client';

import { useState, useTransition } from 'react';
import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { btnPrimary, btnSecondary, btnSizeMd, btnSizeSm } from '@/app/components/ui';
import { Badge, inputClass, labelClass } from './ui';
import { hubResetRequestAction, hubSignInAction, hubSignOutAction } from '@/lib/vistrial/authActions';

/**
 * The front door of team.divineacquisition.io. It says what this is and
 * nothing else: no clients, no pricing.
 */
export default function HubSignIn({ wrongAudience }: { wrongAudience?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'sign_in' | 'forgot' | 'sent'>('sign_in');
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12 text-white antialiased">
      <Backdrop />

      <div className="panel relative z-10 w-full max-w-md rounded-3xl p-6 sm:p-8">
        <Logo className="h-6 w-auto" />

        {wrongAudience ? (
          <>
            <Badge tone="warning" className="mt-6">
              No team account
            </Badge>
            <h1 className="mt-4 text-xl font-semibold">Divine Acquisition Team</h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              {wrongAudience} is signed in, but it is not a Divine Acquisition Team account. Team accounts are created by
              invitation.
            </p>
            <form action={hubSignOutAction} className="mt-6">
              <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
                Sign out
              </button>
            </form>
          </>
        ) : mode === 'sent' ? (
          <>
            <h1 className="mt-6 text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              If that address has a team account, a link to set a new password is on its way. It brings you back here.
            </p>
            <button type="button" onClick={() => setMode('sign_in')} className={`${btnSecondary} ${btnSizeSm} mt-6`}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-semibold">Divine Acquisition Team</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {mode === 'forgot'
                ? 'Enter the email you sign in with and we will send a link to set a new password.'
                : 'Sign in to your team account.'}
            </p>

            <form
              className="mt-7 space-y-4"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  if (mode === 'forgot') {
                    const result = await hubResetRequestAction(formData);
                    if (result.ok) setMode('sent');
                    else setError(result.error);
                    return;
                  }
                  const result = await hubSignInAction(formData);
                  if (result && !result.ok) setError(result.error);
                });
              }}
            >
              <div>
                <label className={labelClass} htmlFor="email">
                  Email
                </label>
                <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
              </div>
              {mode === 'sign_in' ? (
                <div>
                  <label className={labelClass} htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className={inputClass}
                  />
                </div>
              ) : null}

              {error && (
                <p className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
                  {error}
                </p>
              )}

              <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeMd} w-full`}>
                {mode === 'forgot' ? (pending ? 'Sending…' : 'Send the link') : pending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode(mode === 'forgot' ? 'sign_in' : 'forgot');
              }}
              className="mt-4 text-sm text-neutral-400 underline-offset-4 hover:text-white hover:underline"
            >
              {mode === 'forgot' ? 'Back to sign in' : 'Forgot your password?'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
