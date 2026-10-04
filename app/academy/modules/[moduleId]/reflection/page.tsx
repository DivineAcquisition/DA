import { redirect } from 'next/navigation';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { gradeReflectionAttempt } from '@/lib/academy/simActions';
import { loadAcademyShell } from '@/lib/academy/load';
import { academyContentOpen } from '@/lib/academy/types';
import { createClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/workspace/db';

type ReflectionState = {
  phase?: string;
  prompt?: string;
  min_words?: number;
  pass_total?: number;
  criterion_min?: number;
  attempts_used?: number;
  attempts_allowed?: number;
  latest?: {
    status?: string;
    score?: number | null;
    passed?: boolean | null;
    fail_reason?: string | null;
    summary?: string | null;
    criteria?: { key: string; name: string; score: number; evidence?: string[]; next?: string | null }[];
  } | null;
};

async function submitReflection(reflectionId: string, moduleId: string, formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { data, error } = await controlRpc<string>(supabase, 'academy_reflection_submit', {
    p_reflection: reflectionId,
    p_body: String(formData.get('body') ?? ''),
  });
  if (error || !data) redirect(`/academy/modules/${moduleId}/reflection?error=${encodeURIComponent(error ? readable(error) : 'The reflection was not saved.')}`);
  const graded = await gradeReflectionAttempt(data);
  if (!graded) {
    const service = serviceClient();
    if (service) await service.rpc('academy_reflection_manual', { p_attempt: data });
  }
  redirect(`/academy/modules/${moduleId}/reflection`);
}

export default async function ReflectionPage({
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
  const practice = await controlRpc<{ reflection?: string | null }>(supabase, 'academy_module_practice', { p_module: moduleId });
  const reflectionId = practice.data?.reflection;
  if (!reflectionId) return <p className="text-sm text-neutral-300">The reflection is not open.</p>;
  const { data } = await controlRpc<ReflectionState>(supabase, 'academy_reflection_state', { p_reflection: reflectionId });
  const latest = data?.latest;
  const open = latest?.passed !== true && (data?.attempts_used ?? 0) < (data?.attempts_allowed ?? 0) && latest?.status !== 'needs_manual';

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Written reflection</h1>
      <p className="text-sm leading-relaxed text-neutral-300">{data?.prompt}</p>
      <p className="text-sm text-neutral-400">
        At least {data?.min_words} words. Pass {data?.pass_total}, with no criterion below {data?.criterion_min}. Attempts used {data?.attempts_used} of {data?.attempts_allowed}.
      </p>
      {query.error ? <p className="text-sm text-white">{query.error}</p> : null}
      {latest ? (
        <section className="space-y-2 rounded-3xl border border-white/10 p-4 text-sm text-neutral-200">
          <h2 className="text-lg font-semibold">{latest.status === 'needs_manual' ? 'Needs manual grading' : latest.passed ? 'Passed' : 'Not passed'}</h2>
          {latest.score !== null && latest.score !== undefined ? <p>Score {latest.score}.</p> : null}
          {latest.fail_reason ? <p>{latest.fail_reason}</p> : null}
          {latest.summary ? <p className="text-neutral-300">{latest.summary}</p> : null}
          <ul className="space-y-2">
            {(latest.criteria ?? []).map((criterion) => (
              <li key={criterion.key}>
                {criterion.name}: {criterion.score}
                {criterion.next ? <span className="mt-1 block">Next time: {criterion.next}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {open ? (
        <form action={submitReflection.bind(null, reflectionId, moduleId)} className="space-y-3">
          <textarea name="body" required rows={10} className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-base" />
          <button type="submit" className="min-h-11 rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold">Submit</button>
        </form>
      ) : null}
    </div>
  );
}
