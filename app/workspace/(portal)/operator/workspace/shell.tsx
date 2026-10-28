import { getSessionContext } from '@/lib/supabase/server';
import { ViewAsBanner } from './ViewAsBanner';
import WorkspaceFrame from './WorkspaceFrame';

/** The workspace frame, including the view-as banner when a session is open. */
export async function WorkspaceShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const session = await getSessionContext();
  const viewingAs = session?.impersonation?.target_full_name || session?.impersonation?.target_email || null;
  return (
    <WorkspaceFrame wide={wide} banner={viewingAs ? <ViewAsBanner name={viewingAs} /> : null}>
      {children}
    </WorkspaceFrame>
  );
}
