import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { appUrl } from '@/lib/apps';
import { formatDateTime } from '@/lib/portal/time';
import type { DashboardResponse } from '@/lib/sales-workspace/dashboard';
import { isActiveDashboard } from '@/lib/sales-workspace/dashboard';
import { firstName, NO_ACCESS_COPY } from '@/lib/sales-workspace/view';
import { createClient } from '@/lib/supabase/server';
import ActiveDashboard from './dashboard/ActiveDashboard';
import WorkspaceFrame, { brand, DetailGrid, StatePanel, ViewAsBanner } from './WorkspaceFrame';

export const metadata: Metadata = { title: 'Workspace' };
export const dynamic = 'force-dynamic';

/**
 * The Sales Operator workspace. Active placements see the dashboard.
 * Every other state is the access page from the foundation.
 */
export default async function WorkspacePage() {
  const supabase = await createClient();
  const { data, error } = await controlRpc<DashboardResponse>(supabase, 'so_dashboard');

  return (
    <WorkspaceFrame wide={data?.state === 'active'} banner={data ? bannerFor(data) : null}>
      {error || !data ? <Unavailable message={error ? readable(error) : null} /> : <StateView state={data} />}
    </WorkspaceFrame>
  );
}

function bannerFor(state: DashboardResponse) {
  if (!state.viewer?.view_as) return null;
  const zone = state.placement?.time_zone ?? 'America/New_York';
  const returnTo = state.viewer.actor_role === 'manager'
    ? '/vistrial/team/workspace'
    : state.operator_id
      ? `/vistrial/admin/operators/${state.operator_id}`
      : '/vistrial/team';
  return (
    <ViewAsBanner
      name={state.operator_name ?? 'this operator'}
      until={state.viewer.expires_at ? formatDateTime(state.viewer.expires_at, zone) : null}
      returnTo={returnTo}
    />
  );
}

function StateView({ state }: { state: DashboardResponse }) {
  switch (state.state) {
    case 'not_certified':
      return (
        <StatePanel
          eyebrow="Academy certification required"
          title="Certify first. Then the workspace opens."
          body="Your workspace unlocks at Level 1, Certified Operator, in the DA Operator Academy. Finish your modules and pass certification there."
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
        />
      );
    case 'paused':
      return (
        <div className="space-y-4">
          {state.certification ? (
            <div className={`rounded-2xl border px-4 py-3 ${brand.warn}`}>
              <p className="text-sm text-white">
                {state.certification.phase === 'grace'
                  ? `Certification date passed on ${state.certification.recertify_on}. Grace runs through ${state.certification.grace_ends_on}.`
                  : `Recertify by ${state.certification.recertify_on}. You are inside the warning window.`}
              </p>
              <a href={appUrl('training')} className="mt-2 inline-flex text-sm font-semibold text-[#937DFF]">
                Open the Academy
              </a>
            </div>
          ) : null}
          <StatePanel
            eyebrow="Placement paused"
            title="Your placement is paused."
            body="Nothing is due while it is paused. Past end-of-day reports and feedback stay readable here."
            action={
              <Link href="/vistrial/operator/workspace/history" className={brand.primaryButton}>
                Past EODs
              </Link>
            }
          >
            <DetailGrid
              items={[
                { label: 'Client', value: state.placement?.client_name ?? 'Not set' },
                { label: 'Manager', value: state.placement?.manager_name ?? 'Not assigned yet' },
              ]}
            />
          </StatePanel>
        </div>
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
