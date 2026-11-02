import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

type Card = {
  show_welcome: boolean;
  show_guide: boolean;
  client: string | null;
  manager: string | null;
  shift: string | null;
  deadline: string | null;
  tasks: string[];
  day_number: number | null;
};

export async function loadLaunchCard() {
  const supabase = await createClient();
  const { data } = await controlRpc<Card>(supabase, 'so_launch_operator');
  return data;
}

export function LaunchWelcome({ card }: { card: Card | null }) {
  if (!card?.show_welcome) return null;
  return (
    <section className="rounded-3xl border border-[#937DFF]/40 bg-[#6A00FF]/15 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#937DFF]">First day</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Day 1 on {card.client ?? 'your client'}. Here&apos;s how today works.</h2>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-neutral-400">Shift</dt>
          <dd className="text-white">{card.shift ?? 'Set by your manager'}</dd>
        </div>
        <div>
          <dt className="text-neutral-400">EOD deadline</dt>
          <dd className="text-white">{card.deadline ?? 'End of shift'}</dd>
        </div>
        <div>
          <dt className="text-neutral-400">Manager</dt>
          <dd className="text-white">{card.manager ?? 'Your manager'}</dd>
        </div>
      </dl>
      {card.tasks?.length ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-neutral-100">
          {card.tasks.map((task) => (
            <li key={task}>{task}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function EodGuide({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <section className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-5 text-sm text-neutral-200">
      <h2 className="text-base font-semibold text-white">How your EOD works</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>Log the conversations and outcomes from today. A win is only what the offer brief counts.</li>
        <li>Submit by the deadline on the placement clock. After that it is late, then missed.</li>
        <li>The numbers are checked against GHL. You do not edit the GHL-only counts.</li>
      </ul>
    </section>
  );
}
