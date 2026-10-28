import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { saveHoldList, saveHoldSettings } from '@/lib/academy/holdActions';
import { academyAdminSession } from '@/lib/academy/access';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input, Textarea } from '../../../components/ui';

type Summary = {
  opened_30: number;
  reset: number;
  extend: number;
  release: number;
  avg_resolve_hours: number | null;
  quizzes: { quiz_id: string | null; label: string; count: number }[];
  concepts: { concept: string; count: number }[];
  review_deadline_days: number;
  default_attempts_granted: number;
  struggle_reasons: string[];
  release_reasons: string[];
};

export const metadata = { title: 'Hold summary' };

export default async function HoldSummaryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/academy/holds');
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await controlRpc<Summary>(supabase, 'academy_hold_summary');
  if (!data) {
    return <p className="text-sm text-neutral-300">{error?.message ?? 'The summary could not be loaded.'}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/workspace/academy/holds" className="text-sm text-neutral-400">
          Back to holds
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Hold summary</h1>
        <p className="mt-1 text-sm text-neutral-400">The last 30 days. This shows which quizzes and concepts keep opening reviews.</p>
      </div>
      {params.error ? <p className="text-sm text-flag-critical">{params.error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Opened', data.opened_30],
          ['Reset', data.reset],
          ['Extend', data.extend],
          ['Release', data.release],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-neutral-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-neutral-300">
        Average time to resolve: {data.avg_resolve_hours === null ? 'No resolved holds in this window.' : `${data.avg_resolve_hours} hours.`}
      </p>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Quizzes</h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-300">
            {data.quizzes.length === 0 ? <li>None in the last 30 days.</li> : null}
            {data.quizzes.map((quiz) => (
              <li key={quiz.quiz_id ?? quiz.label}>
                {quiz.label}: {quiz.count}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Concepts</h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-300">
            {data.concepts.length === 0 ? <li>None in the last 30 days.</li> : null}
            {data.concepts.map((concept) => (
              <li key={concept.concept}>
                {concept.concept}: {concept.count}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <form action={saveHoldSettings} className="grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-2">
        <h2 className="text-sm font-semibold text-white sm:col-span-2">Settings</h2>
        <Field label="Review deadline, days">
          <Input name="days" type="number" min={1} max={60} defaultValue={data.review_deadline_days} />
        </Field>
        <Field label="Default attempts granted">
          <Input name="attempts" type="number" min={1} max={20} defaultValue={data.default_attempts_granted} />
        </Field>
        <Button type="submit" className="sm:col-span-2 sm:w-fit">
          Save settings
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        <form action={saveHoldList} className="space-y-3 rounded-2xl border border-white/10 p-4">
          <h2 className="text-sm font-semibold text-white">Why they struggled</h2>
          <input type="hidden" name="kind" value="struggle" />
          <Textarea name="labels" rows={8} defaultValue={data.struggle_reasons.join('\n')} />
          <Button type="submit">Save struggle reasons</Button>
        </form>
        <form action={saveHoldList} className="space-y-3 rounded-2xl border border-white/10 p-4">
          <h2 className="text-sm font-semibold text-white">Release reasons</h2>
          <input type="hidden" name="kind" value="release" />
          <Textarea name="labels" rows={8} defaultValue={data.release_reasons.join('\n')} />
          <Button type="submit">Save release reasons</Button>
        </form>
      </div>
    </div>
  );
}
