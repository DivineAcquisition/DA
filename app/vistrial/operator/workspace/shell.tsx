import { controlRpc } from '@/lib/ad/rpc';
import { formatDateTime } from '@/lib/portal/time';
import { createClient } from '@/lib/supabase/server';
import WorkspaceFrame, { ViewAsBanner } from './WorkspaceFrame';

type Session = {
  viewer: { view_as: boolean; actor_role: string | null; expires_at: string | null } | null;
  operator_id: string | null;
  operator_name: string | null;
  time_zone: string | null;
};

/** The workspace frame, including the view-as banner when a session is open. */
export async function WorkspaceShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const supabase = await createClient();
  const { data } = await controlRpc<Session>(supabase, 'so_session');
  const viewer = data?.viewer;
  const returnTo =
    viewer?.actor_role === 'manager'
      ? '/vistrial/team/workspace'
      : data?.operator_id
        ? `/vistrial/admin/operators/${data.operator_id}`
        : '/vistrial/team';
  const banner = viewer?.view_as ? (
    <ViewAsBanner
      name={data?.operator_name ?? 'this operator'}
      until={viewer.expires_at ? formatDateTime(viewer.expires_at, data?.time_zone ?? 'America/New_York') : null}
      returnTo={returnTo}
    />
  ) : null;
  return (
    <WorkspaceFrame wide={wide} banner={banner}>
      {children}
    </WorkspaceFrame>
  );
}
