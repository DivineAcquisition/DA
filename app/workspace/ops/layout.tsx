import NotConfigured from '@/app/da/components/NotConfigured';
import { loadOpsData } from '@/lib/vistrial/load';
import { OpsProvider } from '@/lib/vistrial/store';
import type { Actor } from '@/lib/vistrial/types';
import { createClient, getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Ops admin pages under /workspace/ops need the same data gateway as /vistrial,
 * without a second chrome shell (workspace layout already provides Shell).
 */
export default async function WorkspaceOpsLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;

  const session = await getSessionContext();
  if (!session?.isAdmin) redirect('/workspace/login');

  const supabase = await createClient();
  const { data: operator } = await supabase
    .from('operator')
    .select('id, name')
    .eq('profile_id', session.userId)
    .maybeSingle();

  const actor: Actor = {
    role: 'admin',
    id: session.userId,
    name: session.fullName ?? session.email,
  };

  // Prefer the operator name when the admin also has an operator row.
  if (operator) {
    actor.name = operator.name;
  }

  const data = await loadOpsData();

  return <OpsProvider data={data} actor={actor}>{children}</OpsProvider>;
}
