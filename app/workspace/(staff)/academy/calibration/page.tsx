import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { saveCalibration } from '@/lib/academy/practiceAdmin';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input, Textarea } from '../../components/ui';

type SessionRow = { id: string; title: string; score: number | null; status: string; finished_at: string | null };
type Review = {
  id?: string;
  title?: string;
  score?: number | null;
  criteria?: { key: string; name: string; ai: number | null; human: number | null }[];
  transcript?: { role: string; body: string }[];
};
type Gap = { key: string; average_gap: number; samples: number };

export const metadata = { title: 'Calibration' };

export default async function CalibrationPage({ searchParams }: { searchParams: Promise<{ error?: string; session?: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const params = await searchParams;
  const supabase = await createClient();
  const catalog = await controlRpc<{ graded_sessions?: SessionRow[] }>(supabase, 'academy_practice_catalog');
  const report = await controlRpc<Gap[]>(supabase, 'academy_calibration_report');
  const review = params.session
    ? await controlRpc<Review>(supabase, 'academy_sim_review', { p_session: params.session })
    : null;
  const gaps = Array.isArray(report.data) ? report.data : [];
  const criteria = review?.data?.criteria ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Calibration</h1>
        <Link href="/workspace/academy/simulations" className="text-sm text-neutral-300">Simulations</Link>
      </div>
      {params.error ? <p className="text-sm text-flag-critical">{params.error}</p> : null}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Where the AI drifts</h2>
        {gaps.length === 0 ? <p className="text-sm text-neutral-400">No calibration samples yet.</p> : null}
        <ul className="space-y-1 text-sm text-neutral-200">
          {gaps.map((gap) => (
            <li key={gap.key}>{gap.key}: average gap {gap.average_gap} across {gap.samples} samples</li>
          ))}
        </ul>
      </section>
      <ul className="space-y-1 text-sm text-neutral-200">
        {(catalog.data?.graded_sessions ?? []).map((item) => (
          <li key={item.id}>
            <Link href={`/workspace/academy/calibration?session=${item.id}`}>{item.title} · {item.status} · {item.score ?? '—'}</Link>
          </li>
        ))}
      </ul>
      {review?.data?.id ? (
        <form action={saveCalibration} className="space-y-3">
          <input type="hidden" name="session" value={review.data.id} />
          <input type="hidden" name="count" value={criteria.length} />
          <h2 className="text-lg font-semibold text-white">{review.data.title}</h2>
          <ul className="space-y-1 text-sm text-neutral-300">
            {(review.data.transcript ?? []).map((line, index) => (
              <li key={`${line.role}-${index}`}><span className="text-white">{line.role}:</span> {line.body}</li>
            ))}
          </ul>
          {criteria.map((criterion, index) => (
            <fieldset key={criterion.key} className="space-y-2 rounded-2xl border border-white/10 p-3">
              <input type="hidden" name={`key_${index}`} value={criterion.key} />
              <p className="text-sm text-white">{criterion.name} · AI {criterion.ai ?? '—'}</p>
              <Field label="Your score"><Input name={`score_${index}`} type="number" min={0} max={5} defaultValue={criterion.human ?? ''} /></Field>
              <Textarea name={`note_${index}`} rows={2} placeholder="What you saw" />
            </fieldset>
          ))}
          <Button type="submit">Save calibration scores</Button>
        </form>
      ) : null}
    </div>
  );
}
