import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { saveRubric } from '@/lib/academy/practiceAdmin';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input, Select, Textarea } from '../../components/ui';

type Criterion = {
  key: string;
  name: string;
  description: string;
  weight: number;
  score_0: string;
  score_3: string;
  score_5: string;
  critical: boolean;
  minimum_score: number;
};
type Rubric = { id: string; name: string; kind: string; version: number; criteria?: Criterion[] };

const SLOTS = 8;

export const metadata = { title: 'Rubrics' };

export default async function RubricsPage({ searchParams }: { searchParams: Promise<{ error?: string; id?: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await controlRpc<{ rubrics?: Rubric[] }>(supabase, 'academy_practice_catalog');
  const rubrics = data?.rubrics ?? [];
  const source = rubrics.find((rubric) => rubric.id === params.id) ?? rubrics[0];
  const criteria = source?.criteria ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Rubrics</h1>
        <Link href="/workspace/academy/simulations" className="text-sm text-neutral-300">Simulations</Link>
      </div>
      <p className="text-sm text-neutral-400">Saving creates a new version and keeps the old one. Every graded run records the version it used.</p>
      {params.error ? <p className="text-sm text-flag-critical">{params.error}</p> : null}
      <ul className="space-y-1 text-sm text-neutral-200">
        {rubrics.map((rubric) => (
          <li key={rubric.id}>
            <Link href={`/workspace/academy/rubrics?id=${rubric.id}`}>{rubric.name} v{rubric.version} · {rubric.kind}</Link>
          </li>
        ))}
      </ul>
      <form action={saveRubric} className="space-y-4">
        <input type="hidden" name="count" value={SLOTS} />
        <Field label="Name"><Input name="name" required defaultValue={source?.name ?? 'Conversation'} /></Field>
        <Field label="Kind">
          <Select name="kind" defaultValue={source?.kind ?? 'conversation'}>
            <option value="conversation">Conversation</option>
            <option value="reflection">Reflection</option>
          </Select>
        </Field>
        {Array.from({ length: SLOTS }, (_, index) => {
          const row = criteria[index];
          return (
            <fieldset key={index} className="space-y-2 rounded-2xl border border-white/10 p-3">
              <input type="hidden" name={`key_${index}`} value={row?.key ?? ''} />
              <Field label={`Criterion ${index + 1}`}><Input name={`name_${index}`} defaultValue={row?.name ?? ''} /></Field>
              <Textarea name={`description_${index}`} rows={2} defaultValue={row?.description ?? ''} placeholder="What this criterion measures" />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input name={`weight_${index}`} type="number" defaultValue={row?.weight ?? 1} />
                <Input name={`minimum_${index}`} type="number" defaultValue={row?.minimum_score ?? 0} />
              </div>
              <Textarea name={`score0_${index}`} rows={2} defaultValue={row?.score_0 ?? ''} placeholder="What a 0 looks like" />
              <Textarea name={`score3_${index}`} rows={2} defaultValue={row?.score_3 ?? ''} placeholder="What a 3 looks like" />
              <Textarea name={`score5_${index}`} rows={2} defaultValue={row?.score_5 ?? ''} placeholder="What a 5 looks like" />
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input type="checkbox" name={`critical_${index}`} defaultChecked={Boolean(row?.critical)} /> Critical
              </label>
            </fieldset>
          );
        })}
        <Button type="submit">Save new version</Button>
      </form>
    </div>
  );
}
