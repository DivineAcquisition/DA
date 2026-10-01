'use client';

import { useState, useTransition } from 'react';
import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { btnPrimary, btnSizeMd } from '@/app/components/ui';
import { activateClientInviteAction } from '@/lib/acct/actions';

const field =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-neutral-600 transition-colors focus:border-brand-500/60 focus:bg-white/[0.05] focus:outline-none';
const label = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500';

export function AcceptClientInviteForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5 py-12 text-white antialiased">
      <Backdrop />
      <div className="panel relative z-10 w-full max-w-md rounded-3xl p-8">
        <Logo className="h-6 w-auto" />
        <h1 className="mt-6 text-xl font-semibold">Accept your invitation</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          Create your password with the email this invite was sent to. That binds your account to the
          engagement.
        </p>

        <form
          className="mt-7 space-y-4"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await activateClientInviteAction(formData);
              if (result && !result.ok) setError(result.error);
            });
          }}
        >
          <input type="hidden" name="token" value={token} />

          <div>
            <label className={label} htmlFor="full_name">
              Full name
            </label>
            <input id="full_name" name="full_name" className={field} autoComplete="name" />
          </div>
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
              minLength={10}
              autoComplete="new-password"
              className={field}
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
