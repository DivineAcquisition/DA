import { controlRpc, readable } from '@/lib/ad/rpc';
import type { BoardData } from '@/lib/sales-workspace/dashboard';
import { createClient } from '@/lib/supabase/server';
import { AlertPreview, ExcusedNote, NumbersBoard, TaskList, TodayPlan } from './parts';

/** Tasks, alerts, and numbers. Loaded after the client card and EOD status. */
export default async function Board({ timeZone }: { timeZone: string }) {
  const supabase = await createClient();
  const [{ data, error }, plan, excused] = await Promise.all([
    controlRpc<BoardData>(supabase, 'so_dashboard_board'),
    controlRpc<{ eod_id?: string; work_date?: string; items?: { text?: string; done_at?: string | null }[] }>(supabase, 'so_today_plan'),
    controlRpc<{ work_date: string; reason: string; note: string | null }[]>(supabase, 'so_excused_days'),
  ]);
  if (error || !data || data.state !== 'active') {
    return <p className="rounded-3xl border border-white/[0.07] px-5 py-4 text-sm text-neutral-300">{error ? readable(error) : 'Tasks and numbers could not load.'}</p>;
  }

  return (
    <div className="space-y-4">
      <AlertPreview alerts={data.alerts} unread={data.unread_alerts} timeZone={timeZone} readOnly={data.view_as} />
      <ExcusedNote days={excused.data ?? []} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <TodayPlan plan={plan.data} readOnly={data.view_as} />
          <TaskList tasks={data.tasks} doneToday={data.done_today} readOnly={data.view_as} />
        </div>
        <NumbersBoard data={data} />
      </div>
    </div>
  );
}
