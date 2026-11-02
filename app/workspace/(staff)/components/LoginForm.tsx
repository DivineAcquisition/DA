'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import TeamAuthDesk from '@/app/components/auth/TeamAuthDesk';
import { signInAction } from '@/lib/workspace/actions';

/** Administrator sign-in, on the same desk as the team app. */
export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <TeamAuthDesk
      eyebrow="Admin"
      title="Administrator sign in"
      subtitle="Sign in to the admin workspace. Academy reviewers open the hold queue from here."
    >
      <form
        className="space-y-3.5"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await signInAction(formData);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        <div className="auth-field-block">
          <label className="auth-field-label" htmlFor="email">
            Email
          </label>
          <div className="auth-field">
            <Mail className="auth-field-icon" aria-hidden />
            <input id="email" name="email" type="email" required autoComplete="username" placeholder="you@company.com" className="auth-input" />
          </div>
        </div>
        <div className="auth-field-block">
          <label className="auth-field-label" htmlFor="password">
            Password
          </label>
          <div className="auth-field">
            <Lock className="auth-field-icon" aria-hidden />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Password"
              className="auth-input auth-input--with-action"
            />
            <button
              type="button"
              className="auth-field-action"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {error ? (
          <p role="alert" className="auth-error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="auth-submit">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="mt-3">
        <a href="/workspace/forgot-password" className="auth-alt w-full">
          Forgot your password?
        </a>
      </div>
    </TeamAuthDesk>
  );
}
