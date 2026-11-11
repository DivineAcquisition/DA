import 'server-only';

import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import type { WeekData } from './week';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The billing desk for one seat and week. The database checks that the caller is DA Admin. */
export async function loadWeekCharge(placementId?: string | null, week?: string | null): Promise<{ data: WeekData | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<WeekData>(supabase, 'so_week_charge', {
    p_placement_id: placementId && UUID.test(placementId) ? placementId : null,
    p_week: week && ISO_DAY.test(week) ? week : null,
  });
  if (error || !data) return { data: null, error: readable(error) };
  return { data, error: null };
}
