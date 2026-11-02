'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import TeamAuthDesk from '@/app/components/auth/TeamAuthDesk';
import SignOutButton from '@/app/components/auth/SignOutButton';
import { hubResetRequestAction, hubSignInAction } from '@/lib/vistrial/authActions';

/**
 * Team and admin front door, on the Vistrial auth desk.
 * Forgot-password lives on this same screen and at /workspace/forgot-password.
 */
export default function HubSignIn({
  app = 'team',
  wrongAudience,
  wrongApp,
  initialMode = 'sign_in',
  linkExpired = false,
}: {
  app?: 'team' | 'admin';
  wrongAudience?: string;
  wrongApp?: { email: string; url: string };
  initialMode?: 'sign_in' | 'forgot';
  linkExpired?: boolean;
}) {
  const team = app !== 'admin';
  const title = team ? 'Divine Acquisition Team' : 'Divine Acquisition Admin';
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'sign_in' | 'forgot' | 'sent'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();

  if (wrongApp) {
    return (
      <TeamAuthDesk eyebrow="Wrong app" title="Your account uses the team app" subtitle={`${wrongApp.email} signs in on the team site. The admin app is for owners, admins, and managers.`}>
        <a href="/workspace/auth/leave?to=team" className="auth-submit">
          Go to the team app
        </a>
        <p className="mt-3 text-center text-xs text-white/40">{wrongApp.url}</p>
      </TeamAuthDesk>
    );
  }

  if (wrongAudience) {
    return (
      <TeamAuthDesk eyebrow="No account here" title={title} subtitle={`${wrongAudience} is signed in, but it has no account in this app. Accounts are created by invitation.`}>
        <SignOutButton />
      </TeamAuthDesk>
    );
  }

  if (mode === 'sent') {
    return (
      <TeamAuthDesk eyebrow="Account" title="Check your email" subtitle="If that address has an account, a link to set a new password is on its way. It brings you back here.">
        <button type="button" onClick={() => setMode('sign_in')} className="auth-alt w-full">
          Back to sign in
        </button>
      </TeamAuthDesk>
    );
  }

  const forgot = mode === 'forgot';

  return (
    <TeamAuthDesk
      eyebrow={team ? 'Team' : 'Admin'}
      title={forgot ? 'Forgot your password?' : title}
      subtitle={
        forgot
          ? linkExpired
            ? 'That link has expired. Enter the email you sign in with and we will send a new one.'
            : 'Enter the email you sign in with. We will send a link to set a new password.'
          : team
            ? 'Sign in to your team account.'
            : 'Sign in to the admin app.'
      }
    >
      <form
        className="space-y-3.5"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            if (forgot) {
              const result = await hubResetRequestAction(formData);
              if (result.ok) setMode('sent');
              else setError(result.error);
              return;
            }
            const result = await hubSignInAction(formData);
            if (result && !result.ok) setError(result.error);
          });
        }}
      >
        <div className="auth-field-block">
          <label className="auth-field-label" htmlFor="email">
            Email
          </label>
          <div className="auth-field">
            <Mail className="auth-field-icon" aria-hidden />
            <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" className="auth-input" />
          </div>
        </div>
        {forgot ? null : (
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
        )}
        {error ? (
          <p role="alert" className="auth-error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="auth-submit">
          {forgot ? (pending ? 'Sending…' : 'Send the link') : pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="mt-3">
        {forgot ? (
          <button type="button" onClick={() => { setError(null); setMode('sign_in'); }} className="auth-alt w-full">
            Back to sign in
          </button>
        ) : (
          <a href="/workspace/forgot-password" className="auth-alt w-full">
            Forgot your password?
          </a>
        )}
      </div>
    </TeamAuthDesk>
  );
}
