import type { Metadata } from 'next';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { appUrl } from '@/lib/apps';
import type { CertificationNotice, WorkspaceState } from '@/lib/sales-workspace/types';
import { deadlineLabel, firstName, NO_ACCESS_COPY, shiftLabel } from '@/lib/sales-workspace/view';
import { createClient, getSessionContext } from '@/lib/supabase/server';
import WorkspaceFrame, { brand, DetailGrid, StatePanel } from './WorkspaceFrame';
import { ViewAsBanner } from './ViewAsBanner';

export const metadata: Metadata = { title: 'Workspace' };
export const dynamic = 'force-dynamic';

/**
 * The Sales Operator workspace. The database decides the state from the
 * operator's own records: account, Academy certification, placement.
 */
export default async function WorkspacePage() {
  const [supabase, session] = await Promise.all([createClient(), getSessionContext()]);
  const { data, error } = await controlRpc<WorkspaceState>(supabase, 'so_workspace');
  const viewingAs = session?.impersonation?.target_full_name || session?.impersonation?.target_email || null;

  return (
    <WorkspaceFrame banner={viewingAs ? <ViewAsBanner name={viewingAs} /> : null}>
      {error || !data ? <Unavailable message={error ? readable(error) : null} /> : <State state={data} />}
    </WorkspaceFrame>
  );
}

function CertBanner({ notice }: { notice: CertificationNotice | undefined }) {
  if (!notice || notice.phase === 'current' || !notice.recertify_on) return null;
  const when = new Date(`${notice.recertify_on}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  if (notice.phase === 'warning') {
    return (
      <p className="rounded-xl border border-[#937DFF]/40 bg-[#6A00FF]/15 px-4 py-3 text-sm text-white">
        Recertify by {when}. {notice.days_left} {notice.days_left === 1 ? 'day' : 'days'} left.
      </p>
    );
  }
  return (
    <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
      Your certification lapsed on {when}. You have {notice.days_left} {notice.days_left === 1 ? 'day' : 'days'} of access left. Recertify in the Academy.
    </p>
  );
}

function State({ state }: { state: WorkspaceState }) {
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
          <CertBanner notice={state.certification} />
        </StatePanel>
      );
    case 'paused':
      return (
        <StatePanel
          eyebrow="Placement paused"
          title="Your placement is paused."
          body="Nothing is due while it is paused. Past end-of-day reports and feedback stay readable here."
        >
          <CertBanner notice={state.certification} />
          <DetailGrid
            items={[
              { label: 'Client', value: state.placement.client_name ?? 'Not set' },
              { label: 'Manager', value: state.placement.manager_name ?? 'Not assigned yet' },
            ]}
          />
        </StatePanel>
      );
    case 'active':
      return <ActiveHome state={state} />;
    case 'no_access':
    default: {
      const copy = NO_ACCESS_COPY[(state as { reason: keyof typeof NO_ACCESS_COPY }).reason] ?? NO_ACCESS_COPY.deactivated;
      return <StatePanel eyebrow="No workspace access" title={copy.title} body={copy.body} />;
    }
  }
}

function ActiveHome({ state }: { state: Extract<WorkspaceState, { state: 'active' }> }) {
  const p = state.placement;
  const name = firstName(state.operator_name) || state.operator_name;
  return (
    <div className="space-y-6">
      <CertBanner notice={state.certification} />
      <div>
        <p className={brand.eyebrow}>Active placement</p>
        <h1 className={`${brand.heading} mt-2 text-2xl sm:text-3xl`}>Hi {name}.</h1>
      </div>
      <DetailGrid
        items={[
          { label: 'Operator', value: state.operator_name },
          { label: 'Client', value: p.client_name ?? 'Not set' },
          { label: 'Manager', value: p.manager_name ?? 'Not assigned yet' },
          { label: 'Shift', value: shiftLabel(p) },
          { label: 'EOD deadline', value: deadlineLabel(p) },
        ]}
      />
    </div>
  );
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
