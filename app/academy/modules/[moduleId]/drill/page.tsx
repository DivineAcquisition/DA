import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { loadAcademyShell } from '@/lib/academy/load';
import { academyContentOpen } from '@/lib/academy/types';
import { createClient } from '@/lib/supabase/server';

type DrillState = {
  phase?: string;
  attempt_id?: string | null;
  attempts_used?: number;
  attempts_allowed?: number;
  pass_mark?: number;
  question_count?: number;
  score?: number | null;
  lockout_until?: string | null;
  locked?: boolean;
  items?: { id: string; situation: string; source?: string; reply_speed?: string; earlier_touches?: string; moves?: { id: string; text: string }[] }[];
  missed?: { concept?: string; lesson_id?: string }[];
  review?: { situation?: string; explanation?: string; readiness?: string; correct_move?: string }[];
};

async function startDrill(moduleId: string) {
  'use server';
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'academy_drill_start', { p_module: moduleId });
  if (error) redirect(`/academy/modules/${moduleId}/drill?error=${encodeURIComponent(readable(error))}`);
  redirect(`/academy/modules/${moduleId}/drill`);
}

async function submitDrill(moduleId: string, formData: FormData) {
  'use server';
  const supabase = await createClient();
  const attemptId = String(formData.get('attempt') ?? '');
  const ids = formData.getAll('item').map(String);
  for (const id of ids) {
    await controlRpc(supabase, 'academy_drill_answer', {
      p_attempt: attemptId,
      p_item: id,
      p_readiness: String(formData.get(`ready-${id}`) ?? ''),
      p_move: String(formData.get(`move-${id}`) ?? ''),
    });
  }
  const { error } = await controlRpc(supabase, 'academy_drill_submit', { p_attempt: attemptId });
  if (error) redirect(`/academy/modules/${moduleId}/drill?error=${encodeURIComponent(readable(error))}`);
  redirect(`/academy/modules/${moduleId}/drill`);
}

export default async function DrillPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { moduleId } = await params;
  const query = await searchParams;
  const loaded = await loadAcademyShell();
  if (!loaded.ok || !academyContentOpen(loaded.shell.state)) return null;
  const supabase = await createClient();
  const { data } = await controlRpc<DrillState>(supabase, 'academy_drill_state', { p_module: moduleId });
  const openAttempt = data?.phase === 'take' ? data.items : null;
  const locked = data?.locked === true;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Signal Reading</h1>
      <p className="text-sm text-neutral-300">
        Pass mark {data?.pass_mark} of {data?.question_count}. Attempts used {data?.attempts_used} of {data?.attempts_allowed}.
      </p>
      {query.error ? <p className="text-sm text-white">{query.error}</p> : null}
      {data?.phase === 'fail' ? (
        <section className="space-y-2 text-sm text-neutral-200">
          <p>Score {data.score}. These concepts need another look.</p>
          <ul>
            {(data.missed ?? []).map((item) => (
              <li key={`${item.concept}-${item.lesson_id}`}>
                {item.lesson_id ? (
                  <Link href={`/academy/modules/${moduleId}/lessons/${item.lesson_id}`} className="text-[#937DFF]">{item.concept}</Link>
                ) : item.concept}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data?.phase === 'pass' ? (
        <ul className="space-y-2 text-sm text-neutral-200">
          {(data.review ?? []).map((item) => (
            <li key={item.situation}>
              {item.situation}
              <span className="mt-1 block text-neutral-400">{item.explanation}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {locked ? <p className="text-sm text-neutral-300">Next attempt opens {new Date(data?.lockout_until ?? '').toLocaleString()}.</p> : null}
      {(data?.phase === 'start' || data?.phase === 'fail') && !locked ? (
        <form action={startDrill.bind(null, moduleId)}>
          <button type="submit" className="min-h-11 rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold">Start drill</button>
        </form>
      ) : null}
      {openAttempt ? (
        <form action={submitDrill.bind(null, moduleId)} className="space-y-4">
          <input type="hidden" name="attempt" value={data?.attempt_id ?? ''} />
          {openAttempt.map((item) => (
            <fieldset key={item.id} className="space-y-2 rounded-3xl border border-white/10 p-4">
              <input type="hidden" name="item" value={item.id} />
              <p className="text-sm">{item.situation}</p>
              <p className="text-xs text-neutral-400">{item.source} {item.reply_speed} {item.earlier_touches}</p>
              <label className="block text-sm">
                Readiness
                <select name={`ready-${item.id}`} className="mt-1 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2">
                  <option value="not_ready">Not ready</option>
                  <option value="ready">Ready</option>
                  <option value="not_a_fit">Not a fit</option>
                </select>
              </label>
              <label className="block text-sm">
                Next move
                <select name={`move-${item.id}`} className="mt-1 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2">
                  {(item.moves ?? []).map((move) => (
                    <option key={move.id} value={move.id}>{move.text}</option>
                  ))}
                </select>
              </label>
            </fieldset>
          ))}
          <button type="submit" className="min-h-11 rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold">Submit</button>
        </form>
      ) : null}
    </div>
  );
}