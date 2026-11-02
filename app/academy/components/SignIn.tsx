'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { academySignInAction } from '@/lib/academy/actions';
import { inApp } from '@/lib/academy/comms';
import Panel from './Panel';

export default function SignIn({ linkExpired = false }: { linkExpired?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Panel beam className="w-full max-w-md p-6 sm:p-8">
        <Logo className="h-6 w-auto" />
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#937DFF]">
          {inApp.signIn.tagline}
        </p>
        <h1 className="mt-4 text-2xl font-semibold">{inApp.signIn.headline}</h1>
        {linkExpired ? (
          <p role="status" className="mt-3 text-sm leading-relaxed text-neutral-300">
            That link has expired. Sign in, or request a new one.
          </p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">Sign in with your Divine Acquisition account.</p>
        <form
          className="mt-7 space-y-4"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
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
            {pending ? 'Signing in…' : inApp.signIn.button}
          </button>
        </form>
        <Link href="/academy/forgot-password" className="mt-4 inline-flex min-h-11 items-center text-sm text-neutral-400 underline-offset-4 hover:text-white hover:underline">
          {inApp.signIn.forgot}
        </Link>
      </Panel>
    </div>
  );
}
