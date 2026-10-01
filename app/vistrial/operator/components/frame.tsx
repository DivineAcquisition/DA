import Link from 'next/link';
import { Surface } from '@/components/ui/surface';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import type { PortalLoad } from '@/lib/portal/load';
import type { PortalContext } from '@/lib/portal/types';
import { homeFor, tabAllowed, type TabKey } from '@/lib/portal/zones';
import PortalShell from './PortalShell';

/**
 * Wraps one tab in the portal shell. A tab that needs a placement says so, and
 * one whose data was refused shows the refusal in plain words.
 */
export function renderPortal<T>(
  load: PortalLoad<T>,
  tab: TabKey,
  render: (data: T, placementId: string | null, context: PortalContext) => React.ReactNode,
  options: { needsPlacement?: boolean; whenNoData?: (context: PortalContext) => React.ReactNode } = {},
) {
  if (load.kind === 'closed') return <PortalClosed message={load.message} />;

  let body: React.ReactNode;
  if (load.blocked) body = null;
  else if (!tabAllowed(load.context.stage, tab, load.context.has_history)) body = <NotInStage stage={load.context.stage} />;
  else if (options.whenNoData && (load.error || load.data === null)) body = options.whenNoData(load.context);
  else if (options.needsPlacement && !load.placementId) body = <NoPlacement />;
  else if (load.error) body = <Refused message={load.error} />;
  else if (load.data === null && options.needsPlacement) body = <NoPlacement />;
  else body = render(load.data as T, load.placementId, load.context);

  return (
    <PortalShell context={load.context} placementId={load.placementId} tab={tab} blocked={load.blocked}>
      {body}
    </PortalShell>
  );
}

const STAGE_REASON: Record<PortalContext['stage'], string> = {
  applicant: 'This opens once your onboarding is finished.',
  training: 'During training you work with sample data only, so live bookings, escalations, shift reviews and pay are not part of your account yet.',
  waiting: 'This opens when you are placed with a client.',
  placed: 'This is not part of your account.',
  inactive: 'Your account is closed. Your pay statements and agreements stay available.',
};

function NotInStage({ stage }: { stage: PortalContext['stage'] }) {
  return (
    <Surface as="section" className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-neutral-200">Not part of your account right now</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{STAGE_REASON[stage]}</p>
      <Link href={homeFor(stage)} className={`${btnPrimary} ${btnSizeSm} mt-5`}>
        Go to {stage === 'inactive' ? 'Pay' : 'your home screen'}
      </Link>
    </Surface>
  );
}

function NoPlacement() {
  return (
    <Surface as="section" className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-neutral-200">You are between placements</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
        When DA places you with a client, your shift, bookings and playbook appear here. Your pay, tasks and profile are
        still available below.
      </p>
    </Surface>
  );
}

function Refused({ message }: { message: string }) {
  return (
    <Surface as="section" className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-neutral-200">Not available</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{message}</p>
    </Surface>
  );
}

function PortalClosed({ message }: { message: string }) {
  const staff = /no Sales Operator portal/.test(message);
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4 text-white">
      <Surface as="section" beam className="max-w-md rounded-3xl p-7 text-center">
        <h1 className="text-lg font-semibold">{staff ? 'There is no portal to show' : 'Your portal is closed'}</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          {staff
            ? 'This page is the Sales Operator portal. If you were viewing as an operator, that session has ended.'
            : message}
        </p>
        <Link href="/vistrial" className={`${btnPrimary} ${btnSizeSm} mt-6`}>
          {staff ? 'Back to the hub' : 'Back'}
        </Link>
      </Surface>
    </main>
  );
}
