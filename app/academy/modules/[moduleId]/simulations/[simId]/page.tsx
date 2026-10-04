import Link from 'next/link';
import { controlRpc } from '@/lib/ad/rpc';
import { beginSimulation } from '@/lib/academy/simActions';
import { loadAcademyShell } from '@/lib/academy/load';
import { academyContentOpen } from '@/lib/academy/types';
import { createClient } from '@/lib/supabase/server';
import SimChat from './SimChat';

type SimState = {
  title?: string;
  brief?: string;
  max_turns?: number;
  time_limit_seconds?: number | null;
  pass_score?: number;
  attempts_used?: number;
  attempts_allowed?: number;
  lockout_until?: string | null;
  locked?: boolean;
  daily_limit?: number;
  sessions_today?: number;
  reopen_lessons?: { id: string; title: string; module_id: string }[];
  session?: {
    id: string;
    status: string;
    lead_first_at?: string | null;
    turns?: number;
    messages?: { role?: string; body?: string; at?: string }[];
    score?: number | null;
    passed?: boolean | null;
    fail_reason?: string | null;
    summary?: string | null;
    violations?: string[];
    criteria?: { key: string; name: string; score: number; evidence?: string[]; next?: string | null }[];
    persona?: string | null;
  } | null;
};

export default async function SimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleId: string; simId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { moduleId, simId } = await params;
  const query = await searchParams;
  const loaded = await loadAcademyShell();
  if (!loaded.ok || !academyContentOpen(loaded.shell.state)) return null;
  const supabase = await createClient();
  const { data } = await controlRpc<SimState>(supabase, 'academy_sim_state', { p_simulation: simId });
  if (!data?.title) {
    return <p className="text-sm text-neutral-300">This simulation is not open.</p>;
  }
  const session = data.session;
  const started = session?.lead_first_at ? new Date(session.lead_first_at).toLocaleTimeString() : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#937DFF]">Simulation</p>
        <h1 className="mt-2 text-2xl font-semibold">{data.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">{data.brief}</p>
      </div>
      <p className="text-sm text-neutral-300">
        The lead is an AI playing a fictional person. Maximum {data.max_turns} turns.
        {data.time_limit_seconds ? ` Time limit ${Math.round(data.time_limit_seconds / 60)} minutes.` : ''} Pass score {data.pass_score}.
        Attempts used {data.attempts_used} of {data.attempts_allowed}. Sessions today {data.sessions_today ?? 0} of {data.daily_limit}.
      </p>
      {data.locked ? (
        <p className="text-sm text-neutral-300">Next attempt opens {new Date(data.lockout_until).toLocaleString()}.</p>
      ) : null}
      {(data.reopen_lessons ?? []).length > 0 && session?.passed !== true ? (
        <div className="text-sm text-neutral-300">
          <p>Reopen these lessons before the next attempt.</p>
          <ul>
            {(data.reopen_lessons ?? []).map((lesson) => (
              <li key={lesson.id}>
                <Link href={`/academy/modules/${lesson.module_id}/lessons/${lesson.id}`} className="text-[#937DFF]">{lesson.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {started ? <p className="text-sm text-neutral-300">The clock started at {started}, when the lead wrote.</p> : null}
      {query.error ? <p className="text-sm text-white">{query.error}</p> : null}
      {session?.status === 'graded' || session?.status === 'needs_manual' ? (
        <section className="space-y-2 rounded-3xl border border-white/10 p-4">
          <h2 className="text-lg font-semibold">{session.status === 'needs_manual' ? 'Needs manual grading' : session.passed ? 'Passed' : 'Not passed'}</h2>
          {session.score !== null && session.score !== undefined ? <p className="text-sm">Score {session.score}.</p> : null}
          {session.fail_reason ? <p className="text-sm text-neutral-200">{session.fail_reason}</p> : null}
          {session.summary ? <p className="text-sm text-neutral-300">{session.summary}</p> : null}
          {(session.violations ?? []).length > 0 ? (
            <ul className="text-sm text-neutral-200">
              {session.violations?.map((line) => <li key={line}>{line}</li>)}
            </ul>
          ) : null}
          <ul className="space-y-2 text-sm text-neutral-200">
            {(session.criteria ?? []).map((criterion) => (
              <li key={criterion.key}>
                {criterion.name}: {criterion.score}
                {(criterion.evidence ?? []).map((line) => (
                  <span key={line} className="mt-1 block text-neutral-400">{line}</span>
                ))}
                {criterion.next ? <span className="mt-1 block">Next time: {criterion.next}</span> : null}
              </li>
            ))}
          </ul>
          {session.persona ? <p className="text-sm text-neutral-300">What was hidden: {session.persona}</p> : null}
        </section>
      ) : null}
      {session && session.status !== 'graded' && session.status !== 'needs_manual' ? (
        <SimChat
          moduleId={moduleId}
          simId={simId}
          sessionId={session.id}
          status={session.status}
          messages={session.messages ?? []}
          leadFirstAt={session.lead_first_at}
          timeLimitSeconds={data.time_limit_seconds}
          maxTurns={data.max_turns}
        />
      ) : null}
      {!session ? (
        <form action={beginSimulation.bind(null, moduleId, simId)}>
          <button type="submit" className="min-h-11 w-full rounded-xl bg-[#6A00FF] text-sm font-semibold">
            Start
          </button>
        </form>
      ) : null}
    </div>
  );
}