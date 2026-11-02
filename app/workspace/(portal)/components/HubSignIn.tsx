'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { btnPrimary, btnSecondary, btnSizeMd, btnSizeSm } from '@/app/components/ui';
import { Badge, inputClass, labelClass } from './ui';
import { hubSignInAction, hubSignOutAction } from '@/lib/vistrial/authActions';

/**
 * The front door of each app. It says what this is and nothing else: no
 * clients, no pricing. The team app is for VAs and SDRs; the admin app for
 * owners, admins and managers.
 */
export default function HubSignIn({
  app = 'team',
  wrongAudience,
  wrongApp,
}: {
  app?: 'team' | 'admin';
  wrongAudience?: string;
  /** A VA signed into the admin app: their account uses the team app. */
  wrongApp?: { email: string; url: string };
}) {
  const title = app === 'admin' ? 'Divine Acquisition Admin' : 'Divine Acquisition Team';
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12 text-white antialiased">
      <Backdrop />

      <div className="panel relative z-10 w-full max-w-md rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <Logo className="h-6 w-auto" />
          {app === 'admin' ? (
            <span className="rounded-full border border-brand-400/40 bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-100">Admin</span>
          ) : null}
        </div>

        {wrongApp ? (
          <>
            <Badge tone="warning" className="mt-6">
              Wrong app
            </Badge>
            <h1 className="mt-4 text-xl font-semibold">Your account uses the team app</h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              {wrongApp.email} is a team account. The admin app is for owners, admins and managers. Sign in to the team app instead.
            </p>
            <a href="/workspace/auth/leave?to=team" className={`${btnPrimary} ${btnSizeMd} mt-6`}>
              Go to the team app
            </a>
            <p className="mt-3 text-xs text-neutral-500">{wrongApp.url}</p>
          </>
        ) : wrongAudience ? (
          <>
            <Badge tone="warning" className="mt-6">
              No team account
            </Badge>
            <h1 className="mt-4 text-xl font-semibold">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">
              {wrongAudience} is signed in, but it has no account in this app. Accounts are created by invitation.
            </p>
            <form action={hubSignOutAction} className="mt-6">
              <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {app === 'admin' ? 'Sign in to the admin app.' : 'Sign in to your team account.'}
            </p>

            <form
              className="mt-7 space-y-4"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
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
            <Link href="/workspace/forgot-password" className="mt-4 inline-block text-sm text-neutral-400 underline-offset-4 hover:text-white hover:underline">
              Forgot your password?
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
