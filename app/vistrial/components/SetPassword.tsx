'use client';

import { useState, useTransition } from 'react';
import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { btnPrimary, btnSizeMd } from '@/app/components/ui';
import { inputClass, labelClass } from './ui';
import { hubSetPasswordAction } from '@/lib/vistrial/authActions';

/** Reached from a password reset email: choose the new password, then continue. */
export default function SetPassword() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12 text-white antialiased">
      <Backdrop />
      <div className="panel relative z-10 w-full max-w-md rounded-3xl p-6 sm:p-8">
        <Logo className="h-6 w-auto" />
        <h1 className="mt-6 text-xl font-semibold">Set a new password</h1>
        <p className="mt-2 text-sm text-neutral-400">At least 12 characters.</p>
        <form
          className="mt-6 space-y-4"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await hubSetPasswordAction(formData);
              if (result && !result.ok) setError(result.error);
            });
          }}
        >
          <div>
            <label className={labelClass} htmlFor="password">
              New password
            </label>
            <input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="confirm">
              Type it again
            </label>
            <input id="confirm" name="confirm" type="password" required minLength={12} autoComplete="new-password" className={inputClass} />
          </div>
          {error ? <p className="text-sm text-flag-critical">{error}</p> : null}
          <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeMd} w-full`}>
            {pending ? 'Saving…' : 'Save and continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
