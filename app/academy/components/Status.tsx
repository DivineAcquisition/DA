import Link from 'next/link';
import type { AcademyShell } from '@/lib/academy/types';
import Panel from './Panel';

function Card({ title, body }: { title: string; body: string }) {
  return (
    <Panel className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-300">{body}</p>
    </Panel>
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
  const program = shell.program?.name ?? 'Your program';
  const manager = shell.hold?.managerName ?? 'your manager';
  const opened = shell.hold?.openedAt ? new Date(shell.hold.openedAt).toLocaleDateString() : null;
  const started = shell.hold?.reviewStartedAt ? new Date(shell.hold.reviewStartedAt).toLocaleDateString() : null;
  return (
    <Panel className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Your progress is under review.</h1>
      <p className="text-sm leading-relaxed text-neutral-300">
        This is a check that the material is landing. It is not a judgment about you.
      </p>
      <p className="text-sm leading-relaxed text-neutral-300">
        {program} is with {manager}.
      </p>
      <p className="text-sm leading-relaxed text-neutral-300">
        {started
          ? `The review started ${started}.`
          : opened
            ? `The review opened ${opened}. It has not started.`
            : 'The review has not started.'}
      </p>
      <p className="text-sm leading-relaxed text-neutral-300">
        What happens next: {manager} finishes the review. You then continue with a plan, or your Academy access closes.
        Nothing else is open until then.
      </p>
    </Panel>
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

export function LoadError({ message }: { message?: string }) {
  const detail = message && message !== 'The Academy could not be loaded.'
    ? message
    : 'Refresh the page. If it keeps happening, contact your manager.';
  return <Card title="The Academy could not be loaded." body={detail} />;
}

export function NotFoundScreen({ signedIn }: { signedIn: boolean }) {
  return (
    <Panel className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">This page is not in the Academy.</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-300">The address does not match a screen.</p>
      <Link
        href="/academy"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold text-white"
      >
        {signedIn ? 'Back to the dashboard' : 'Back to sign in'}
      </Link>
    </Panel>
  );
}
