import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { beginPreview, saveSimulation } from '@/lib/academy/simActions';
import { createClient } from '@/lib/supabase/server';
import { Button, Field, Input, Select, Textarea } from '../../components/ui';

type Part = { id: string; key: string; label: string };
type ModuleRow = { id: string; order: number; title: string; parts?: Part[] };
type Pack = { id: string; name: string; version: number };
type Rubric = { id: string; name: string; version: number };
type Simulation = {
  id: string;
  title: string;
  status: string;
  vertical: string;
  module_id: string;
  capstone: boolean;
};
type Catalog = { modules?: ModuleRow[]; packs?: Pack[]; rubrics?: Rubric[]; simulations?: Simulation[] };
type Draft = {
  id?: string;
  title?: string;
  vertical?: string;
  module_id?: string;
  gate_part_id?: string | null;
  brief?: string;
  persona?: string;
  difficulty?: string;
  offer_pack_id?: string | null;
  rubric_id?: string | null;
  max_turns?: number;
  time_limit_seconds?: number | null;
  pass_score?: number | null;
  capstone?: boolean;
  status?: string;
};

export const metadata = { title: 'Simulations' };

export default async function SimulationsPage({ searchParams }: { searchParams: Promise<{ error?: string; id?: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await controlRpc<Catalog>(supabase, 'academy_practice_catalog');
  const modules = data?.modules ?? [];
  const packs = data?.packs ?? [];
  const rubrics = data?.rubrics ?? [];
  const simulations = data?.simulations ?? [];
  let draft: Draft | null = null;
  if (params.id) {
    const loaded = await controlRpc<Draft>(supabase, 'academy_sim_admin', { p_simulation: params.id });
    draft = loaded.data;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Simulations</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/workspace/academy/simulations/import" className="rounded-full border border-white/15 px-3 py-1.5 text-white">Import</Link>
          <a href="/workspace/academy/simulations/template" className="rounded-full border border-white/15 px-3 py-1.5 text-white">Template</a>
          <Link href="/workspace/academy/offers" className="rounded-full border border-white/15 px-3 py-1.5 text-white">Offer Pack</Link>
          <Link href="/workspace/academy/rubrics" className="rounded-full border border-white/15 px-3 py-1.5 text-white">Rubrics</Link>
          <Link href="/workspace/academy/drills/import" className="rounded-full border border-white/15 px-3 py-1.5 text-white">Signal Reading</Link>
          <Link href="/workspace/academy/reflections" className="rounded-full border border-white/15 px-3 py-1.5 text-white">Reflection</Link>
          <Link href="/workspace/academy/practicals" className="rounded-full border border-white/15 px-3 py-1.5 text-white">Practicals</Link>
          <Link href="/workspace/academy/practice" className="rounded-full border border-white/15 px-3 py-1.5 text-white">Settings</Link>
          <Link href="/workspace/academy/calibration" className="rounded-full border border-white/15 px-3 py-1.5 text-white">Calibration</Link>
        </div>
      </div>
      {params.error ? <p className="text-sm text-flag-critical">{params.error}</p> : null}
      <ul className="space-y-2 text-sm text-neutral-200">
        {simulations.length === 0 ? <li className="text-neutral-500">No simulations yet.</li> : null}
        {simulations.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 px-3 py-2">
            <span>{item.title} · {item.status}{item.capstone ? ' · capstone' : ''}</span>
            <span className="flex gap-3">
              <Link href={`/workspace/academy/simulations?id=${item.id}`}>Edit</Link>
              <form action={beginPreview.bind(null, item.id)}>
                <button type="submit" className="text-[#937DFF]">Preview</button>
              </form>
            </span>
          </li>
        ))}
      </ul>
      <form action={saveSimulation} className="grid gap-3 rounded-2xl border border-white/10 p-4">
        <input type="hidden" name="id" value={draft?.id ?? ''} />
        <Field label="Title"><Input name="title" required defaultValue={draft?.title ?? ''} /></Field>
        <Field label="Vertical">
          <Select name="vertical" defaultValue={draft?.vertical ?? 'general'}>
            <option value="med_spa">Med Spa</option>
            <option value="home_services">Home Services</option>
            <option value="coaches">Coaches and Consultants</option>
            <option value="general">General</option>
          </Select>
        </Field>
        <Field label="Module">
          <Select name="module_id" defaultValue={draft?.module_id ?? modules[0]?.id ?? ''} required>
            {modules.map((module) => (
              <option key={module.id} value={module.id}>{module.order}. {module.title}</option>
            ))}
          </Select>
        </Field>
        <Field label="Gate part">
          <Select name="gate_part_id" defaultValue={draft?.gate_part_id ?? ''}>
            <option value="">None</option>
            {modules.flatMap((module) => (module.parts ?? []).map((part) => (
              <option key={part.id} value={part.id}>Module {module.order}: {part.label}</option>
            )))}
          </Select>
        </Field>
        <Field label="Offer Pack version">
          <Select name="offer_pack_id" defaultValue={draft?.offer_pack_id ?? ''}>
            <option value="">None</option>
            {packs.map((pack) => (
              <option key={pack.id} value={pack.id}>{pack.name} v{pack.version}</option>
            ))}
          </Select>
        </Field>
        <Field label="Rubric version">
          <Select name="rubric_id" defaultValue={draft?.rubric_id ?? ''}>
            <option value="">None</option>
            {rubrics.map((rubric) => (
              <option key={rubric.id} value={rubric.id}>{rubric.name} v{rubric.version}</option>
            ))}
          </Select>
        </Field>
        <Field label="Brief"><Textarea name="brief" rows={4} defaultValue={draft?.brief ?? ''} /></Field>
        <Field label="Persona"><Textarea name="persona" rows={4} defaultValue={draft?.persona ?? ''} /></Field>
        <Field label="Difficulty">
          <Select name="difficulty" defaultValue={draft?.difficulty ?? 'standard'}>
            <option value="easy">Easy</option>
            <option value="standard">Standard</option>
            <option value="hard">Hard</option>
          </Select>
        </Field>
        <Field label="Max turns"><Input name="max_turns" type="number" defaultValue={draft?.max_turns ?? 12} /></Field>
        <Field label="Time limit seconds"><Input name="time_limit_seconds" type="number" defaultValue={draft?.time_limit_seconds ?? ''} /></Field>
        <Field label="Pass score"><Input name="pass_score" type="number" defaultValue={draft?.pass_score ?? ''} /></Field>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" name="capstone" defaultChecked={Boolean(draft?.capstone)} /> Capstone
        </label>
        <Field label="Status">
          <Select name="status" defaultValue={draft?.status ?? 'draft'}>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="live">Live</option>
          </Select>
        </Field>
        <p className="text-xs text-neutral-500">A simulation cannot go Live without a brief, a persona, an Offer Pack version, and a rubric. Preview does not record an attempt or a score.</p>
        <Button type="submit">Save</Button>
      </form>
    </div>
  );
}
