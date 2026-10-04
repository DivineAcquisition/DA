import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { saveReflectionPrompt } from '@/lib/academy/practiceAdmin';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input, Select, Textarea } from '../../components/ui';

type ModuleRow = { id: string; order: number; title: string; parts?: { id: string; key: string; label: string }[] };
type Rubric = { id: string; name: string; kind: string; version: number };
type Reflection = {
  id: string;
  module_id: string;
  gate_part_id: string | null;
  prompt: string;
  min_words: number;
  rubric_id: string | null;
  pass_total: number;
  criterion_min: number;
  status: string;
};

export const metadata = { title: 'Written reflection' };

export default async function ReflectionsAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; id?: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await controlRpc<{ modules?: ModuleRow[]; rubrics?: Rubric[]; reflections?: Reflection[] }>(supabase, 'academy_practice_catalog');
  const current = (data?.reflections ?? []).find((item) => item.id === params.id) ?? data?.reflections?.[0];
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Written reflection</h1>
        <Link href="/workspace/academy/simulations" className="text-sm text-neutral-300">Simulations</Link>
      </div>
      {params.error ? <p className="text-sm text-flag-critical">{params.error}</p> : null}
      <ul className="space-y-1 text-sm text-neutral-300">
        {(data?.reflections ?? []).map((item) => (
          <li key={item.id}><Link href={`/workspace/academy/reflections?id=${item.id}`}>{item.status}: {item.prompt.slice(0, 80) || 'Untitled'}</Link></li>
        ))}
      </ul>
      <form action={saveReflectionPrompt} className="grid gap-3">
        <input type="hidden" name="id" value={current?.id ?? ''} />
        <Field label="Module">
          <Select name="module_id" defaultValue={current?.module_id ?? ''}>
            {(data?.modules ?? []).map((module) => <option key={module.id} value={module.id}>{module.order}. {module.title}</option>)}
          </Select>
        </Field>
        <Field label="Gate part">
          <Select name="gate_part_id" defaultValue={current?.gate_part_id ?? ''}>
            <option value="">None</option>
            {(data?.modules ?? []).flatMap((module) => (module.parts ?? []).filter((part) => part.key === 'practical').map((part) => (
              <option key={part.id} value={part.id}>Module {module.order}: {part.label}</option>
            )))}
          </Select>
        </Field>
        <Field label="Rubric">
          <Select name="rubric_id" defaultValue={current?.rubric_id ?? ''}>
            <option value="">None</option>
            {(data?.rubrics ?? []).filter((rubric) => rubric.kind === 'reflection').map((rubric) => (
              <option key={rubric.id} value={rubric.id}>{rubric.name} v{rubric.version}</option>
            ))}
          </Select>
        </Field>
        <Field label="Prompt"><Textarea name="prompt" rows={6} defaultValue={current?.prompt ?? ''} /></Field>
        <Field label="Minimum words"><Input name="min_words" type="number" defaultValue={current?.min_words ?? 150} /></Field>
        <Field label="Pass total"><Input name="pass_total" type="number" defaultValue={current?.pass_total ?? 10} /></Field>
        <Field label="Minimum per criterion"><Input name="criterion_min" type="number" defaultValue={current?.criterion_min ?? 2} /></Field>
        <Field label="Status">
          <Select name="status" defaultValue={current?.status ?? 'draft'}>
            <option value="draft">Draft</option>
            <option value="live">Live</option>
          </Select>
        </Field>
        <Button type="submit" className="w-fit">Save reflection</Button>
      </form>
    </div>
  );
}
