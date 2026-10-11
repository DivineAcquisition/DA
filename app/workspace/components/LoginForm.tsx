'use client';

import { useState, useTransition } from 'react';
import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { signInAction } from '@/lib/workspace/actions';
import { Button, Field, Input, ws } from './ui';

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="da-admin-shell relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-background px-5 py-12 text-card-foreground antialiased">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-[22%] left-1/2 h-[520px] w-[820px] -translate-x-1/2"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(154,136,252,0.18) 0%, transparent 70%)',
            filter: 'blur(64px)',
            animation: 'app-breathe 9s ease-in-out infinite',
          }}
        />
      </div>
      <Backdrop />
      <div className={`${ws.card} relative z-10 w-full max-w-md animate-rise p-7 sm:p-8`}>
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-8 w-auto" />
          <h1 className="mt-6 font-heading text-[1.75rem] tracking-tight text-white">Administrator sign in</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-silver">Divine Acquisition admin workspace. Academy reviewers open the hold queue from here.</p>
        </div>

        <form
          className="space-y-4"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await signInAction(formData);
              if (!result.ok) setError(result.error);
            });
          }}
        >
          <Field label="Email">
            <Input name="email" type="email" autoComplete="username" required />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          {error && (
            <p className="rounded-xl border border-flag-critical/30 bg-flag-critical/10 px-3 py-2 text-sm text-flag-critical">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
