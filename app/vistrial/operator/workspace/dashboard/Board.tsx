import { controlRpc, readable } from '@/lib/ad/rpc';
import type { BoardData } from '@/lib/sales-workspace/dashboard';
import { createClient } from '@/lib/supabase/server';
import { AlertPreview, NumbersBoard, TaskList } from './parts';

/** Tasks, alerts, and numbers. Loaded after the client card and EOD status. */
export default async function Board({ timeZone }: { timeZone: string }) {
  const supabase = await createClient();
  const { data, error } = await controlRpc<BoardData>(supabase, 'so_dashboard_board');
  if (error || !data || data.state !== 'active') {
    return <p className="rounded-3xl border border-white/[0.07] px-5 py-4 text-sm text-neutral-300">{error ? readable(error) : 'Tasks and numbers could not load.'}</p>;
  }

  return (
    <div className="space-y-4">
      <AlertPreview alerts={data.alerts} unread={data.unread_alerts} timeZone={timeZone} readOnly={data.view_as} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <TaskList tasks={data.tasks} doneToday={data.done_today} readOnly={data.view_as} />
        <NumbersBoard data={data} />
      </div>
    </div>
  );
}
