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
    <div className="relative flex min-h-screen items-center justify-center bg-ink-950 px-5 py-12 text-white antialiased">
      <Backdrop />
      <div className={`${ws.card} relative z-10 w-full max-w-md animate-rise p-7 sm:p-8`}>
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-8 w-auto" />
          <h1 className={`${ws.heading} mt-6 text-2xl font-semibold`}>Administrator sign in</h1>
          <p className="mt-2 text-sm text-neutral-400">Divine Acquisition admin workspace</p>
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
