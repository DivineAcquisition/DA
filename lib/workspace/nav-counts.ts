import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import type { NavCounts } from '@/lib/workspace/adminNav';

export type { NavCounts };

export async function loadNavCounts(): Promise<NavCounts> {
  const supabase = await createClient();
  const { data } = await controlRpc<NavCounts>(supabase, 'so_nav_counts');
  return {
    home: data?.home ?? 0,
    escalations: data?.escalations ?? 0,
    eods: data?.eods ?? 0,
    reports: data?.reports ?? 0,
    holds: data?.holds ?? 0,
  };
}
