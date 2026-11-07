import { controlRpc } from '@/lib/ad/rpc';
import { createClient, getSessionContext } from '@/lib/supabase/server';
import { countApplicants } from '@/lib/operators/desk';
import type { NavCounts } from '@/lib/workspace/adminNav';

export type { NavCounts };

export async function loadNavCounts(): Promise<NavCounts> {
  const supabase = await createClient();
  const session = await getSessionContext();
  const [{ data }, applicants] = await Promise.all([
    controlRpc<NavCounts>(supabase, 'so_nav_counts'),
    session?.isAdmin ? countApplicants().catch(() => 0) : Promise.resolve(0),
  ]);
  return {
    home: data?.home ?? 0,
    escalations: data?.escalations ?? 0,
    eods: data?.eods ?? 0,
    reports: data?.reports ?? 0,
    holds: data?.holds ?? 0,
    applicants,
  };
}
