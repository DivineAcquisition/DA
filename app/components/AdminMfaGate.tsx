'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Logo from '@/app/components/Logo';
import { btnPrimary, btnSecondary, btnSizeMd, btnSizeSm } from '@/app/components/ui';
import { adminMfaEnrollAction, adminMfaVerifyAction } from '@/lib/auth/mfaActions';

/**
 * Every admin-app account uses a second factor. Shown in place of any admin
 * screen until this session has verified one.
 */
export default function AdminMfaGate({
  state,
  factorId,
  email,
  signOut,
}: {
  state: 'enroll' | 'challenge';
  factorId: string | null;
  email: string;
  signOut: () => Promise<void>;
}) {
  const router = useRouter();
  const [enrolment, setEnrolment] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const activeFactor = enrolment?.factorId ?? factorId;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 py-12 text-white antialiased">
      <div className="panel w-full max-w-md rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <Logo className="h-6 w-auto" />
          <span className="rounded-full border border-brand-400/40 bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-100">Admin</span>
        </div>
        <h1 className="mt-6 text-xl font-semibold">Two-factor sign-in</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          {state === 'enroll'
            ? `Every admin account uses an authenticator app. Set one up for ${email} to continue.`
            : `Enter the code from your authenticator app for ${email}.`}
        </p>

        {state === 'enroll' && !enrolment ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await adminMfaEnrollAction();
                if (result.ok && result.data) setEnrolment(result.data);
                else if (!result.ok) setError(result.error);
              })
            }
            className={`${btnPrimary} ${btnSizeMd} mt-6`}
          >
            Set up an authenticator app
          </button>
        ) : (
          <div className="mt-6 space-y-4">
            {enrolment ? (
              <div className="space-y-2 text-sm text-neutral-300">
                <p>Scan this with your authenticator app, then enter the six-digit code it shows.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enrolment.qr} alt="Authenticator QR code" className="h-44 w-44 rounded-xl bg-white p-2" />
                <p className="text-xs text-neutral-500">
                  Or enter this key: <span className="select-all font-mono text-neutral-300">{enrolment.secret}</span>
                </p>
              </div>
            ) : null}
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-lg tracking-[0.3em] text-white outline-none focus:border-brand-400"
            />
            <button
              type="button"
              disabled={pending || !activeFactor || code.replace(/\s+/g, '').length < 6}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const result = await adminMfaVerifyAction(activeFactor!, code);
                  if (result.ok) router.refresh();
                  else setError(result.error);
                })
              }
              className={`${btnPrimary} ${btnSizeMd} w-full`}
            >
              Verify
            </button>
          </div>
        )}
        {error ? <p role="alert" className="mt-3 text-sm text-flag-critical">{error}</p> : null}
        <form action={signOut} className="mt-6">
          <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
