'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { btnPrimary, btnSizeMd } from '@/app/components/ui';
import { inputClass, labelClass } from '@/app/workspace/(portal)/components/ui';
import type { PasswordResult } from '@/lib/auth/password';

/** Asks for the sign-in email and sends a link to set a new password. */
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12 text-white antialiased">
      <Backdrop />
      <div className="panel relative z-10 w-full max-w-md rounded-3xl p-6 sm:p-8">
        <Logo className="h-6 w-auto" />
        {sent ? (
          <>
            <h1 className="mt-6 text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              If that address has an account, a link to set a new password is on its way. It brings you back here.
            </p>
            <Link href={backHref} className="mt-6 inline-block text-sm text-neutral-400 underline-offset-4 hover:text-white hover:underline">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-semibold">Forgot your password?</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {linkExpired
                ? 'That link has expired. Enter the email you sign in with and we will send a new one.'
                : 'Enter the email you sign in with and we will send a link to set a new password.'}
            </p>
            <form
              className="mt-6 space-y-4"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  const result = await action(formData);
                  if (result.ok) setSent(true);
                  else setError(result.error);
                });
              }}
            >
              <div>
                <label className={labelClass} htmlFor="email">
                  Email
                </label>
                <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
              </div>
              {error ? (
                <p role="alert" className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeMd} w-full`}>
                {pending ? 'Sending…' : 'Send the link'}
              </button>
            </form>
            <Link href={backHref} className="mt-4 inline-block text-sm text-neutral-400 underline-offset-4 hover:text-white hover:underline">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
