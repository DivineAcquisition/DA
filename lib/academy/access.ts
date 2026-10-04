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

/** Academy Admin or Reviewer. Admins still have to pass the workspace admin gate. */
export async function academyHoldSession() {
  const session = await getSessionContext();
  if (!session) return null;
  const supabase = await createClient();
  const [manage, review] = await Promise.all([
    controlRpc<boolean>(supabase, 'academy_can_manage'),
    controlRpc<boolean>(supabase, 'academy_can_review'),
  ]);
  if (manage.data !== true && review.data !== true) return null;
  return { ...session, manage: manage.data === true };
}
