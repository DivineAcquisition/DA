'use client';

import { useState, useTransition } from 'react';
import Logo from '@/app/components/Logo';
import { academyResetAction, academySignInAction } from '@/lib/academy/actions';

export default function SignIn({ linkExpired = false }: { linkExpired?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'sign_in' | 'forgot' | 'sent'>('sign_in');
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <Logo className="h-6 w-auto" />
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#937DFF]">
          Devotion. Value. Exclusivity.
        </p>

        {mode === 'sent' ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold">Check your email</h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-300">
              If that address has an account, a link to set a new password is on its way. It brings you back here.
            </p>
            <button
              type="button"
              onClick={() => setMode('sign_in')}
              className="mt-6 min-h-11 text-sm text-neutral-300 underline-offset-4 hover:text-white hover:underline"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-semibold">DA Operator Academy</h1>
            {linkExpired ? (
              <p role="status" className="mt-3 text-sm leading-relaxed text-neutral-300">
                That link has expired. Sign in, or request a new one.
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">
              {mode === 'forgot'
                ? 'Enter the email you sign in with. We will send a link to set a new password.'
                : 'Sign in with your Divine Acquisition account.'}
            </p>
            <form
              className="mt-7 space-y-4"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  if (mode === 'forgot') {
                    const result = await academyResetAction(formData);
                    if (result.ok) setMode('sent');
                    else setError(result.error);
                    return;
                  }
                  const result = await academySignInAction(formData);
                  if (result && !result.ok) setError(result.error);
                });
              }}
            >
              <div>
                <label className="mb-1.5 block text-sm text-neutral-300" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-base text-white outline-none"
                />
              </div>
              {mode === 'sign_in' ? (
                <div>
                  <label className="mb-1.5 block text-sm text-neutral-300" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-base text-white outline-none"
                  />
                </div>
              ) : null}
              {error ? (
                <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-200">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 w-full rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {mode === 'forgot' ? (pending ? 'Sending…' : 'Send the link') : pending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode(mode === 'forgot' ? 'sign_in' : 'forgot');
              }}
              className="mt-4 min-h-11 text-sm text-neutral-400 underline-offset-4 hover:text-white hover:underline"
            >
              {mode === 'forgot' ? 'Back to sign in' : 'Forgot your password?'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
