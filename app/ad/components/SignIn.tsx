'use client';

import { useState, useTransition } from 'react';
import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { btnPrimary, btnSecondary, btnSizeMd, btnSizeSm } from '@/app/components/ui';
import { Badge, inputClass, labelClass } from '@/app/vistrial/components/ui';
import { signInAction, signOutAction } from '@/lib/ad/actions';

export default function SignIn({
  refusedFor,
  blockedReason,
}: {
  refusedFor?: string;
  blockedReason?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5 py-12 text-white antialiased">
      <Backdrop />

      <div className="panel relative z-10 w-full max-w-md rounded-3xl p-8">
        <Logo className="h-6 w-auto" />

        {blockedReason ? (
          <>
            <Badge tone="critical" className="mt-6">
              Account blocked
            </Badge>
            <h1 className="mt-4 text-xl font-semibold">You cannot sign in right now</h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">{blockedReason}</p>
            {refusedFor && (
              <form action={signOutAction} className="mt-6">
                <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
                  Sign out
                </button>
              </form>
            )}
          </>
        ) : refusedFor ? (
          <>
            <Badge tone="critical" className="mt-6">
              Refused at the data layer
            </Badge>
            <h1 className="mt-4 text-xl font-semibold">This surface is for control-plane staff</h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              {refusedFor} is signed in without Owner, Admin or Manager. The account roster and
              oversight tools stay empty for this role.
            </p>
            <form action={signOutAction} className="mt-6">
              <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-semibold">Roles &amp; admin workspace</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              Invite-only. Sign-in is rate-limited and locked after repeated failures. There is no
              public signup.
            </p>

            <form
              className="mt-7 space-y-4"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  const result = await signInAction(formData);
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
      </div>
    </div>
  );
}
