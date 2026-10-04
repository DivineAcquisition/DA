import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { savePracticalDefinition } from '@/lib/academy/practiceAdmin';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input, Select, Textarea } from '../../components/ui';

type ModuleRow = { id: string; order: number; title: string; parts?: { id: string; key: string; label: string }[] };
type Item = { label: string; required: boolean };
type Practical = {
  id: string;
  module_id: string;
  gate_part_id: string | null;
  title: string;
  instructions: string;
  status: string;
  items?: Item[];
};

export const metadata = { title: 'Practicals' };

export default async function PracticalsAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; id?: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await controlRpc<{ modules?: ModuleRow[]; practicals?: Practical[] }>(supabase, 'academy_practice_catalog');
  const current = (data?.practicals ?? []).find((item) => item.id === params.id);
  const lines = (current?.items ?? []).map((item) => (item.required ? item.label : `optional ${item.label}`)).join('\n');
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Practicals</h1>
        <Link href="/workspace/academy/holds/practicals" className="text-sm text-neutral-300">Review queue</Link>
      </div>
      <p className="text-sm text-neutral-400">One checklist line per item. Start a line with “optional” when it is not required to pass. Checklist edits apply before the first submission.</p>
      {params.error ? <p className="text-sm text-flag-critical">{params.error}</p> : null}
      <ul className="space-y-1 text-sm text-neutral-300">
        {(data?.practicals ?? []).map((item) => (
          <li key={item.id}><Link href={`/workspace/academy/practicals?id=${item.id}`}>{item.title} · {item.status}</Link></li>
        ))}
      </ul>
      <form action={savePracticalDefinition} className="grid gap-3">
        <input type="hidden" name="id" value={current?.id ?? ''} />
        <Field label="Title"><Input name="title" required defaultValue={current?.title ?? ''} /></Field>
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
        <Field label="Instructions"><Textarea name="instructions" rows={5} defaultValue={current?.instructions ?? ''} /></Field>
        <Field label="Checklist"><Textarea name="items" rows={6} defaultValue={lines} /></Field>
        <Field label="Status">
          <Select name="status" defaultValue={current?.status ?? 'draft'}>
            <option value="draft">Draft</option>
            <option value="live">Live</option>
          </Select>
        </Field>
        <Button type="submit" className="w-fit">Save practical</Button>
      </form>
    </div>
  );
}
