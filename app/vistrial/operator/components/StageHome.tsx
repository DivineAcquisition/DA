'use client';

import Link from 'next/link';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { formatDate } from '@/lib/portal/time';
import type { AvailabilityData, TasksData } from '@/lib/portal/types';
import { Meter } from '../../components/ui';
import AvailabilityEditor from './AvailabilityEditor';
import { Card, CardTitle, usePortal } from './portal';

function OnboardingCard() {
  const { context } = usePortal();
  const onboarding = context.onboarding;
  if (!onboarding || onboarding.status !== 'pending') return null;
  return (
    <Card className="border border-brand-500/30">
      <p className="text-sm font-semibold text-white">Finish your onboarding</p>
      <p className="mt-1 text-sm text-neutral-400">{onboarding.protocol_name} is not finished yet.</p>
      {onboarding.link_token ? (
        <a href={`/o/${onboarding.link_token}`} className={`${btnPrimary} ${btnSizeSm} mt-3`}>
          Continue onboarding
        </a>
      ) : null}
    </Card>
  );
}

/** Applicant: onboarding, the signed agreement and the profile. Nothing else. */
export function ApplicantHome() {
  const { context } = usePortal();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Welcome, {context.operator.first_name || context.operator.name}</h1>
      <OnboardingCard />
      {!context.onboarding || context.onboarding.status !== 'pending' ? (
        <Card>
          <p className="text-sm text-neutral-300">
            Your onboarding is in. DA will be in touch about training; your account opens up as you move through it.
          </p>
        </Card>
      ) : null}
      <Card>
        <CardTitle>Your account</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Link href="/vistrial/operator/agreements" className={`${btnSecondary} ${btnSizeSm}`}>
            Your signed agreement
          </Link>
          <Link href="/vistrial/operator/profile" className={`${btnSecondary} ${btnSizeSm}`}>
            Profile
          </Link>
        </div>
      </Card>
    </div>
  );
}

/** Training: progress, what is left, and the sample-data rule. */
export function TrainingHome({ tasks }: { tasks: TasksData | null }) {
  const { context } = usePortal();
  const training = tasks?.training ?? [];
  const done = training.filter((t) => t.completed_on).length;
  const left = training.filter((t) => !t.completed_on);
  const due = (tasks?.tasks ?? []).filter((t) => !t.completed_on && t.due_on).sort((a, b) => (a.due_on! < b.due_on! ? -1 : 1));
  const target = due.find((t) => /certif/i.test(t.title))?.due_on ?? null;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Training</h1>
      <OnboardingCard />
      <Card>
        <CardTitle aside={<span className="text-xs text-neutral-500">{done} of {training.length} done</span>}>Your progress</CardTitle>
        {training.length > 0 ? <Meter value={done / training.length} /> : <p className="text-sm text-neutral-500">DA has not assigned your training yet.</p>}
        {target ? <p className="mt-3 text-sm text-neutral-300">Target certification date: {formatDate(target, true)}</p> : null}
        {left.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-sm">
            {left.slice(0, 5).map((t) => (
              <li key={t.id} className="rounded-xl bg-white/[0.03] px-3 py-2 text-neutral-200">
                {t.title}
              </li>
            ))}
          </ul>
        ) : null}
        <Link href="/vistrial/operator/tasks" className={`${btnPrimary} ${btnSizeSm} mt-4`}>
          Open training
        </Link>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-white">Sample data only</p>
        <p className="mt-1 text-sm text-neutral-400">
          Training involves no live customers and no commercial work. Everything you practise on here is labelled sample data.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/vistrial/operator/playbook" className={`${btnSecondary} ${btnSizeSm}`}>
            Sample playbook
          </Link>
          <Link href="/vistrial/operator/standards" className={`${btnSecondary} ${btnSizeSm}`}>
            The standards you will be held to
          </Link>
        </div>
      </Card>
      <p className="text-xs text-neutral-600">Signed in as {context.operator.name}</p>
    </div>
  );
}

/** Certified or on bench: waiting for placement, with availability. */
export function WaitingHome({ availability }: { availability: AvailabilityData | null }) {
  const { context } = usePortal();
  const op = context.operator;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">You&apos;re certified. Waiting for placement.</h1>
      <Card>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-xs text-neutral-500">Tier</p>
            <p className="text-lg font-semibold text-white">{op.tier ? `Tier ${op.tier}` : 'Tier 1'}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-xs text-neutral-500">Certified</p>
            <p className="text-lg font-semibold text-white">{op.certified_on ? formatDate(op.certified_on, true) : 'Recorded by DA'}</p>
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold text-white">What happens next</p>
        <p className="mt-1 text-sm text-neutral-400">
          DA matches certified VAs to placements using the windows you can work. When you are placed, your shift, response clock
          and playbook appear here, and you are told straight away.
        </p>
      </Card>
      {availability ? <AvailabilityEditor data={availability} /> : null}
      <div className="flex flex-wrap gap-2">
        <Link href="/vistrial/operator/growth" className={`${btnSecondary} ${btnSizeSm}`}>
          Tier and growth
        </Link>
        <Link href="/vistrial/operator/standards" className={`${btnSecondary} ${btnSizeSm}`}>
          Standards
        </Link>
        {context.has_pay ? (
          <Link href="/vistrial/operator/pay" className={`${btnSecondary} ${btnSizeSm}`}>
            Pay history
          </Link>
        ) : null}
      </div>
    </div>
  );
}
