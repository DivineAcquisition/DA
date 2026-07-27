'use client';

import { useState, useTransition } from 'react';
import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { btnPrimary, btnSizeMd } from '@/app/components/ui';
import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import { acceptInviteAction } from '@/lib/ad/actions';

export function AcceptInviteForm({ initialToken }: { initialToken: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5 py-12 text-white antialiased">
      <Backdrop />
      <div className="panel relative z-10 w-full max-w-md rounded-3xl p-8">
        <Logo className="h-6 w-auto" />
        <h1 className="mt-6 text-xl font-semibold">Accept invitation</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Set your password to activate the account. Uninvited signups stay pending with no scope.
        </p>
        <form
          className="mt-7 space-y-4"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await acceptInviteAction(formData);
              if (result && !result.ok) setError(result.error);
            });
          }}
        >
          <div>
            <label className={labelClass} htmlFor="token">
              Invite token
            </label>
            <input
              id="token"
              name="token"
              required
              className={inputClass}
              defaultValue={initialToken}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="full_name">
              Full name
            </label>
            <input id="full_name" name="full_name" className={inputClass} />
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
              minLength={10}
              className={inputClass}
            />
          </div>
          {error && (
            <p className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeMd} w-full`}>
            {pending ? 'Activating…' : 'Activate account'}
          </button>
        </form>
      </div>
    </div>
  );
}
