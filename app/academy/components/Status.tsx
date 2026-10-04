import Link from 'next/link';
import type { AcademyShell } from '@/lib/academy/types';

function Card({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-300">{body}</p>
    </section>
  );
}

export function AgreementPending({ shell }: { shell: AcademyShell }) {
  const program = shell.program?.name;
  return (
    <Card
      title="Your agreement is not signed."
      body={
        program
          ? `${program} opens after you sign your operator agreement. Use the signing link in your email, then come back.`
          : 'The Academy opens after you sign your operator agreement. Use the signing link in your email, then come back.'
      }
    />
  );
}

export function OnHold({ shell }: { shell: AcademyShell }) {
  const program = shell.program?.name;
  return (
    <Card
      title="Your progress is under review."
      body={
        program
          ? `${program} is with your manager. Nothing else is open until that review is finished.`
          : 'Your progress is with your manager. Nothing else is open until that review is finished.'
      }
    />
  );
}

export function NoAccess() {
  return (
    <Card
      title="This account does not have Academy access."
      body="If that is unexpected, contact your manager."
    />
  );
}

export function NoEnrollment() {
  return (
    <Card
      title="No enrollment yet."
      body="When you are enrolled in a program, it will show here."
    />
  );
}

export function Invited({ shell }: { shell: AcademyShell }) {
  const program = shell.program?.name ?? 'Your program';
  return (
    <Card
      title="Your enrollment is not active yet."
      body={`${program} will show its modules when the enrollment starts.`}
    />
  );
}

export function LoadError() {
  return (
    <Card
      title="The Academy could not be loaded."
      body="Refresh the page. If it keeps happening, contact your manager."
    />
  );
}

export function NotFoundScreen({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <h1 className="text-2xl font-semibold">This page is not in the Academy.</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-300">The address does not match a screen.</p>
      <Link
        href="/academy"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold text-white"
      >
        {signedIn ? 'Back to the dashboard' : 'Back to sign in'}
      </Link>
    </section>
  );
}
