import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyHoldSession } from '@/lib/academy/access';
import { overrideScore } from '@/lib/academy/practiceAdmin';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input, Textarea } from '../../../components/ui';

type Queue = {
  waiting?: number;
  simulations?: { id: string; title: string; finished_at: string | null; trainee_name: string }[];
  reflections?: { id: string; created_at: string; trainee_name: string; body: string }[];
};
type Review = {
  id?: string;
  title?: string;
  body?: string;
  fail_reason?: string | null;
  summary?: string | null;
  transcript?: { role: string; body: string }[];
  criteria?: { key: string; name: string; ai: number | null; human: number | null }[];
  flags?: string[];
};

export const metadata = { title: 'Manual grading' };

export default async function ManualGradingPage({ searchParams }: { searchParams: Promise<{ error?: string; session?: string; reflection?: string }> }) {
  const actor = await academyHoldSession();
  if (!actor) redirect('/workspace/login');
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await controlRpc<Queue>(supabase, 'academy_manual_queue');
  const review = params.session
    ? await controlRpc<Review>(supabase, 'academy_sim_review', { p_session: params.session })
    : params.reflection
      ? await controlRpc<Review>(supabase, 'academy_reflection_review', { p_attempt: params.reflection })
      : null;
  const back = params.session
    ? `/workspace/academy/holds/grading?session=${params.session}`
    : params.reflection
      ? `/workspace/academy/holds/grading?reflection=${params.reflection}`
      : '/workspace/academy/holds/grading';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Needs manual grading</h1>
        <Link href="/workspace/academy/holds" className="text-sm text-neutral-400">Holds</Link>
      </div>
      <p className="text-sm text-neutral-400">{data?.waiting ?? 0} waiting. A failed grader call does not pass or fail the trainee.</p>
      {params.error ? <p className="text-sm text-flag-critical">{params.error}</p> : null}
      <ul className="space-y-1 text-sm text-neutral-200">
        {(data?.simulations ?? []).map((item) => (
          <li key={item.id}><Link href={`/workspace/academy/holds/grading?session=${item.id}`}>{item.trainee_name} · {item.title}</Link></li>
        ))}
        {(data?.reflections ?? []).map((item) => (
          <li key={item.id}><Link href={`/workspace/academy/holds/grading?reflection=${item.id}`}>{item.trainee_name} · Reflection</Link></li>
        ))}
      </ul>
      {review?.data?.id ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{review.data.title}</h2>
          {review.data.fail_reason ? <p className="text-sm text-neutral-300">{review.data.fail_reason}</p> : null}
          <ul className="space-y-1 text-sm text-neutral-300">
            {(review.data.transcript ?? []).map((line, index) => (
              <li key={`${line.role}-${index}`}><span className="text-white">{line.role}:</span> {line.body}</li>
            ))}
          </ul>
          {(review.data.flags ?? []).length > 0 ? <p className="text-sm text-amber-200">Role-change attempt recorded.</p> : null}
          {(review.data.criteria ?? []).map((criterion) => (
            <form key={criterion.key} action={overrideScore} className="space-y-2 rounded-2xl border border-white/10 p-3">
              <input type="hidden" name="session" value={review.data?.id} />
              <input type="hidden" name="key" value={criterion.key} />
              <input type="hidden" name="back" value={back} />
              <p className="text-sm text-white">{criterion.name} · AI {criterion.ai ?? '—'} · reviewer {criterion.human ?? '—'}</p>
              <Field label="Score"><Input name="score" type="number" min={0} max={5} required /></Field>
              <Textarea name="note" rows={2} required placeholder="Why this score changed" />
              <Button type="submit">Save override</Button>
            </form>
          ))}
        </section>
      ) : null}
      {params.reflection && review?.data?.id ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Reflection</h2>
          <p className="whitespace-pre-wrap text-sm text-neutral-300">{review.data.body}</p>
          {(review.data.criteria ?? []).map((criterion) => (
            <form key={criterion.key} action={overrideScore} className="space-y-2 rounded-2xl border border-white/10 p-3">
              <input type="hidden" name="reflection" value={review.data?.id} />
              <input type="hidden" name="key" value={criterion.key} />
              <input type="hidden" name="back" value={back} />
              <p className="text-sm text-white">{criterion.name} · AI {criterion.ai ?? '—'} · reviewer {criterion.human ?? '—'}</p>
              <Field label="Score"><Input name="score" type="number" min={0} max={5} required /></Field>
              <Textarea name="note" rows={2} required placeholder="Why this score changed" />
              <Button type="submit">Save override</Button>
            </form>
          ))}
        </section>
      ) : null}
    </div>
  );
}
