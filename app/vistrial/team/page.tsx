import type { Metadata } from 'next';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import TeamNav from './TeamNav';
import TeamView, { type RosterRow } from './TeamView';

export const metadata: Metadata = { title: 'Team' };
export const dynamic = 'force-dynamic';

/**
 * The operators this staff member can reach: every operator for an owner or
 * admin, the ones placed with clients in scope for a manager. The roster
 * function decides; this page only lists it.
 */
export default async function TeamPage() {
  const supabase = await createClient();
  const { data, error } = await controlRpc<RosterRow[]>(supabase, 'staff_operator_roster', {});
  return (
    <>
      <TeamNav />
      <TeamView rows={data ?? []} error={error ? readable(error) : null} />
    </>
  );
}
