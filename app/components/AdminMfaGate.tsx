'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import TeamAuthDesk from '@/app/components/auth/TeamAuthDesk';
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

  const subtitle =
    state === 'enroll'
      ? `Every admin account uses an authenticator app. Set one up for ${email} to continue.`
      : `Enter the code from your authenticator app for ${email}.`;

  return (
    <TeamAuthDesk eyebrow="Admin" title="Two-factor sign-in" subtitle={subtitle}>
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
          className="auth-submit"
        >
          Set up an authenticator app
        </button>
      ) : (
        <div className="space-y-3.5">
          {enrolment ? (
            <div className="space-y-2 text-sm text-neutral-300">
              <p>Scan this with your authenticator app, then enter the six-digit code it shows.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrolment.qr} alt="Authenticator QR code" className="h-44 w-44 rounded-xl bg-[#ffffff] p-2" />
              <p className="text-xs text-neutral-500">
                Or enter this key: <span className="select-all font-mono text-neutral-300">{enrolment.secret}</span>
              </p>
            </div>
          ) : null}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            aria-label="Authentication code"
            className="auth-input auth-input--plain text-center tracking-[0.3em]"
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
            className="auth-submit"
          >
            Verify
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="auth-error mt-3">
          {error}
        </p>
      ) : null}
      <form action={signOut} className="mt-3">
        <button type="submit" className="auth-alt w-full">
          Sign out
        </button>
      </form>
    </TeamAuthDesk>
  );
}
