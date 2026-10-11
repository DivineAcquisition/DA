import Link from 'next/link';
import { ACADEMY_COMMS, inApp } from '@/lib/academy/comms';
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
  const manager = shell.hold?.managerName;
  const subject = encodeURIComponent('Please resend my agreement');
  return (
    <Panel className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{inApp.agreement.headline}</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-300">{inApp.agreement.body(manager)}</p>
      <a
        href={`mailto:${ACADEMY_COMMS.supportEmail}?subject=${subject}`}
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold text-white"
      >
        {inApp.agreement.button}
      </a>
    </Panel>
  );
}

export function OnHold({ shell }: { shell: AcademyShell }) {
  const manager = shell.hold?.managerName;
  const held = shell.modules.find((module) => module.quiz?.status === 'on_hold');
  return (
    <Panel className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{inApp.hold.headline}</h1>
      <p className="text-sm leading-relaxed text-neutral-300">
        {inApp.hold.body({
          managerName: manager,
          quizName: held ? `${held.title} quiz` : undefined,
          attemptsMax: held?.quiz?.attemptsAllowed,
        })}
      </p>
    </Panel>
  );
}

export function NoAccess() {
  return <Card title="Academy access" body={inApp.signIn.noAccess()} />;
}

export function NoEnrollment() {
  return <Card title="Enrollment" body={inApp.dashboard.empty()} />;
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
  const detail = message && message !== 'The Academy could not be loaded.' ? message : inApp.system.generic();
  return <Card title="The Academy could not be loaded." body={detail} />;
}

export function NotFoundScreen({ signedIn }: { signedIn: boolean }) {
  return (
    <Panel className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{inApp.system.notFound}</h1>
      <Link
        href="/academy"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold text-white"
      >
        {signedIn ? 'Back to the dashboard' : 'Back to sign in'}
      </Link>
    </Panel>
  );
}
