'use client';

import { AuthPanel } from '@/components/ui/surface';
import { useState, useTransition } from 'react';
import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { btnPrimary, btnSecondary, btnSizeMd, btnSizeSm } from '@/app/components/ui';
import { assessmentSignInAction, assessmentSignOutAction } from '@/lib/assessment/actions';

const field =
  'field-control w-full rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600';
const label = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500';

export default function AdminSignIn({ refusedFor }: { refusedFor?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5 py-12 text-white antialiased">
      <Backdrop />
      <AuthPanel>
        <Logo className="h-6 w-auto" />

        {refusedFor ? (
          <>
            <p className="mt-6 inline-flex rounded-full border border-flag-critical/30 bg-flag-critical/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-flag-critical">
              Admin only
            </p>
            <h1 className="mt-4 text-xl font-semibold">This surface is admin-only</h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              {refusedFor} is signed in without an admin role.
            </p>
            <form action={assessmentSignOutAction} className="mt-6">
              <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-semibold">Assessment admin</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Send personal 24-hour booking links for SDR / operator assessment calls.
            </p>

            <form
              className="mt-7 space-y-4"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  const result = await assessmentSignInAction(formData);
                  if (result && !result.ok) setError(result.error);
                });
              }}
            >
              <div>
                <label className={label} htmlFor="email">
                  Email
                </label>
                <input id="email" name="email" type="email" required autoComplete="email" className={field} />
              </div>
              <div>
                <label className={label} htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className={field}
                />
              </div>

              {error && (
                <p className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
                  {error}
                </p>
              )}

              <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeMd} w-full`}>
                {pending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        )}
      </AuthPanel>
    </div>
  );
}
