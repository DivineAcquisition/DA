import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { appUrl } from '@/lib/apps';
import type { CertificationNotice } from '@/lib/sales-workspace/types';
import { firstName, NO_ACCESS_COPY } from '@/lib/sales-workspace/view';
import { createClient, getSessionContext } from '@/lib/supabase/server';
import ActiveDashboard from './dashboard/ActiveDashboard';
import { isActiveDashboard, type DashboardResponse } from '@/lib/sales-workspace/dashboard';
import { ViewAsBanner } from './ViewAsBanner';
import WorkspaceFrame, { brand, DetailGrid, StatePanel } from './WorkspaceFrame';

export const metadata: Metadata = { title: 'Workspace' };
export const dynamic = 'force-dynamic';

/**
 * The Sales Operator workspace. Active placements see the dashboard.
 * Every other state is the access page from the foundation.
 */
export default async function WorkspacePage() {
  const [supabase, session] = await Promise.all([createClient(), getSessionContext()]);
  await controlRpc(supabase, 'so_eod_sweep');
  const { data, error } = await controlRpc<DashboardResponse>(supabase, 'so_dashboard');
  const viewingAs = session?.impersonation?.target_full_name || session?.impersonation?.target_email || null;

  return (
    <WorkspaceFrame wide={data?.state === 'active'} banner={viewingAs ? <ViewAsBanner name={viewingAs} /> : null}>
      {error || !data ? <Unavailable message={error ? readable(error) : null} /> : <StateView state={data} />}
    </WorkspaceFrame>
  );
}

function CertBanner({ notice }: { notice: CertificationNotice | undefined }) {
  if (!notice || notice.phase === 'current' || !notice.recertify_on) return null;
  const when = new Date(`${notice.recertify_on}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  if (notice.phase === 'warning') {
    return (
      <p className="rounded-xl border border-[#937DFF]/40 bg-[#6A00FF]/15 px-4 py-3 text-sm text-white">
        Recertify by {when}. {notice.days_left} {notice.days_left === 1 ? 'day' : 'days'} left.{' '}
        <a href={appUrl('training')} className="font-semibold text-[#937DFF]">
          Open the Academy
        </a>
      </p>
    );
  }
  return (
    <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
      Your certification lapsed on {when}. You have {notice.days_left} {notice.days_left === 1 ? 'day' : 'days'} of access left.{' '}
      <a href={appUrl('training')} className="font-semibold text-amber-50">
        Recertify in the Academy
      </a>
    </p>
  );
}

function StateView({ state }: { state: DashboardResponse }) {
  switch (state.state) {
    case 'not_certified':
      return (
        <StatePanel
          eyebrow="Academy certification required"
          title="Certify first. Then the workspace opens."
          body={
            state.grace_ended
              ? 'The grace period after your re-certification date has ended. Certify again at Level 1 to reopen the workspace.'
              : 'Your workspace unlocks at Level 1, Certified Operator, in the DA Operator Academy. Finish your modules and pass certification there.'
          }
          action={
            <a href={appUrl('training')} className={brand.primaryButton}>
              Open the Academy
            </a>
          }
        />
      );
    case 'awaiting_placement':
      return (
        <StatePanel
          eyebrow="Certified"
          title={`You're certified${firstName(state.operator_name) ? `, ${firstName(state.operator_name)}` : ''}. Placement is next.`}
          body={
            state.pending
              ? 'Your placement is being set up. Metrics and your end-of-day report open the day it starts.'
              : 'DA is matching you with a client. Metrics and your end-of-day report open the day your placement starts.'
          }
        >
          <CertBanner notice={state.certification as CertificationNotice | undefined} />
        </StatePanel>
      );
    case 'paused':
      return (
        <StatePanel
          eyebrow="Placement paused"
          title="Your placement is paused."
          body="Nothing is due while it is paused. Past end-of-day reports and feedback stay readable here."
          action={
            <Link href="/workspace/operator/workspace/history" className={brand.primaryButton}>
              Past EODs
            </Link>
          }
        >
          <CertBanner notice={state.certification as CertificationNotice | undefined} />
          <DetailGrid
            items={[
              { label: 'Client', value: state.placement?.client_name ?? 'Not set' },
              { label: 'Manager', value: state.placement?.manager_name ?? 'Not assigned yet' },
            ]}
          />
        </StatePanel>
      );
    case 'active':
      if (!isActiveDashboard(state)) return <Unavailable message={null} />;
      return <ActiveDashboard data={state} />;
    case 'no_access':
    default: {
      const reason = (state.reason ?? 'deactivated') as keyof typeof NO_ACCESS_COPY;
      const copy = NO_ACCESS_COPY[reason] ?? NO_ACCESS_COPY.deactivated;
      return <StatePanel eyebrow="No workspace access" title={copy.title} body={copy.body} />;
    }
  }
}

function Unavailable({ message }: { message: string | null }) {
  return (
    <StatePanel
      eyebrow="Workspace"
      title="The workspace could not load."
      body={message ?? 'Refresh the page. If it keeps happening, message your manager.'}
    />
  );
}
