import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

export type NavCounts = { home: number; escalations: number };

export async function loadNavCounts(): Promise<NavCounts> {
  const supabase = await createClient();
  const { data } = await controlRpc<NavCounts>(supabase, 'so_nav_counts');
  return { home: data?.home ?? 0, escalations: data?.escalations ?? 0 };
}
