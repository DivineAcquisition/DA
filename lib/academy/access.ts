import { controlRpc } from '@/lib/ad/rpc';
import { createClient, getSessionContext } from '@/lib/supabase/server';

export async function academyAdminSession() {
  const session = await getSessionContext();
  if (!session?.isAdmin) return null;
  const supabase = await createClient();
  const { data, error } = await controlRpc<boolean>(supabase, 'academy_can_manage');
  if (error || data !== true) return null;
  return session;
}
