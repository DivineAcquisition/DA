import type { Metadata } from 'next';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import SettingsNav from '../components/SettingsNav';
import TaskDesk, { type StaffTask, type TaskRosterRow } from './TaskDesk';

export const metadata: Metadata = { title: 'Operator tasks' };
export const dynamic = 'force-dynamic';

export default async function SalesOpsTasksPage({ searchParams }: { searchParams: Promise<{ placement?: string }> }) {
  const { placement } = await searchParams;
  const supabase = await createClient();
  const roster = await controlRpc<TaskRosterRow[]>(supabase, 'so_task_roster');
  const rows = roster.data ?? [];
  const placementId = rows.some((row) => row.placement_id === placement) ? placement! : (rows[0]?.placement_id ?? null);
  const tasks = placementId ? await controlRpc<StaffTask[]>(supabase, 'so_task_list', { p_placement_id: placementId }) : { data: [], error: null };

  return (
    <>
    <SettingsNav />
    <TaskDesk
      basePath="/workspace/sales-ops/tasks"
      roster={rows}
      placementId={placementId}
      tasks={tasks.data ?? []}
      error={roster.error ? readable(roster.error) : tasks.error ? readable(tasks.error) : null}
    />
    </>
  );
}
