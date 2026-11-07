import { controlRpc, readable } from '@/lib/ad/rpc';
import { suggestTarget } from '@/lib/placement/launch';
import { resolveSetupMismatchAction } from '@/lib/placement/actions';
import { setTeamTargetAction } from '@/lib/sales-workspace/team-actions';
import { createClient } from '@/lib/supabase/server';

type Week = {
  window: number;
  data_days: number;
  is_admin: boolean;
  targets_set: boolean;
  days: Array<{
    date: string;
    number: number;
    eod_status: string | null;
    eod_at: string | null;
    needs_help: boolean | null;
    conversations: number | null;
    dials: number | null;
    outcomes: Record<string, number>;
    health: string | null;
    feedback: boolean;
  }>;
  averages: Array<{ metric: string; label: string; average: number | null; template_daily: number | null }>;
  mismatches: Array<{ id: string; date: string; metric: string; gap: number; setup: boolean }>;
};

export default async function FirstWeek({ placementId }: { placementId: string }) {
  const supabase = await createClient();
  const { data, error } = await controlRpc<Week>(supabase, 'so_launch_week', { p_placement: placementId });
  if (error || !data) return <p className="text-sm text-amber-200">{error ? readable(error) : 'The first week did not load.'}</p>;
  return (
    <section className="panel space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="text-lg font-semibold text-white">First week</h2>
        <p className="text-sm text-neutral-400">
          {data.data_days < 3 ? 'Fewer than three working days have data, so this panel runs through the next working week.' : `The first ${data.window} working days.`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr>
              <th className="py-2 pr-3">Day</th>
              <th className="py-2 pr-3">EOD</th>
              <th className="py-2 pr-3">Conversations</th>
              <th className="py-2 pr-3">Dials</th>
              <th className="py-2 pr-3">Outcomes</th>
              <th className="py-2 pr-3">Health</th>
              <th className="py-2">Feedback</th>
            </tr>
          </thead>
          <tbody>
            {data.days.map((day) => (
              <tr key={day.date} className="border-t border-white/10">
                <td className="py-2 pr-3 text-white">{day.number}. {day.date}</td>
                <td className="py-2 pr-3 text-neutral-300">{day.eod_status ?? 'Not opened'}{day.needs_help ? ' · help' : ''}</td>
                <td className="py-2 pr-3 text-neutral-300">{day.conversations ?? '—'}</td>
                <td className="py-2 pr-3 text-neutral-300">{day.dials ?? '—'}</td>
                <td className="py-2 pr-3 text-neutral-300">{Object.entries(day.outcomes ?? {}).map(([name, value]) => `${name} ${value}`).join(', ') || '—'}</td>
                <td className="py-2 pr-3 text-neutral-300">{day.health ?? '—'}</td>
                <td className="py-2 text-neutral-300">{day.feedback ? 'Given' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">Running average per working day</h3>
        <ul className="mt-2 space-y-3 text-sm">
          {data.averages.filter((row) => row.average !== null || row.template_daily !== null).map((row) => {
            const suggestion = suggestTarget(row.average === null ? null : Number(row.average), row.template_daily === null ? null : Number(row.template_daily));
            return (
              <li key={row.metric} className="rounded-xl border border-white/10 p-3">
                <p className="text-white">{row.label}</p>
                <p className="text-neutral-400">
                  Average {suggestion.hold ?? '—'}. Hold {suggestion.hold ?? '—'}. Stretch {suggestion.stretch ?? '—'}. Template {suggestion.template ?? '—'}.
                </p>
                <form action={setTarget.bind(null, placementId, row.metric)} className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="text-neutral-300">
                    Daily
                    <input name="daily" type="number" min={0} step="0.1" placeholder={suggestion.hold?.toString() ?? ''} className="mt-1 block h-9 w-24 rounded-lg border border-white/10 bg-transparent px-2" />
                  </label>
                  <label className="text-neutral-300">
                    Weekly
                    <input name="weekly" type="number" min={0} step="0.1" className="mt-1 block h-9 w-24 rounded-lg border border-white/10 bg-transparent px-2" />
                  </label>
                  <button className="h-9 rounded-lg bg-[#6A00FF] px-3 text-white" type="submit">
                    Save target
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-neutral-500">Suggestions stay suggestions until you save a number.</p>
      </div>
      {data.is_admin && data.mismatches.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-white">First-week mismatches</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {data.mismatches.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 text-neutral-300">
                <span>{row.date} · {row.metric} · gap {row.gap}</span>
                {row.setup ? <span>Setup issue</span> : (
                  <form action={resolveSetup.bind(null, row.id)}>
                    <button className="underline" type="submit">Resolve as setup</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

async function setTarget(placementId: string, metric: string, formData: FormData) {
  'use server';
  await setTeamTargetAction(placementId, metric, formData);
}

async function resolveSetup(id: string) {
  'use server';
  await resolveSetupMismatchAction(id);
}
