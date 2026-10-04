import { controlRpc } from '@/lib/ad/rpc';
import { submitPractical } from '@/lib/academy/practiceAdmin';
import { loadAcademyShell } from '@/lib/academy/load';
import { academyContentOpen } from '@/lib/academy/types';
import { createClient } from '@/lib/supabase/server';

type Item = {
  id: string;
  label: string;
  required: boolean;
  status: string;
  comment?: string | null;
  open?: boolean;
  evidence_id?: string | null;
  has_file?: boolean;
};
type PracticalState = {
  phase?: string;
  id?: string;
  title?: string;
  instructions?: string;
  submissions_used?: number;
  submissions_allowed?: number;
  status?: string;
  items?: Item[];
};

export default async function PracticalPage({
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
  const practice = await controlRpc<{ practical?: string | null }>(supabase, 'academy_module_practice', { p_module: moduleId });
  const practicalId = practice.data?.practical;
  if (!practicalId) return <p className="text-sm text-neutral-300">The practical is not open.</p>;
  const { data } = await controlRpc<PracticalState>(supabase, 'academy_practical_state', { p_practical: practicalId });
  const openItems = (data?.items ?? []).filter((item) => item.open);
  const canSubmit = data?.status !== 'passed' && data?.status !== 'pending' && (data?.submissions_used ?? 0) < (data?.submissions_allowed ?? 0) && openItems.length > 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{data?.title ?? 'Practical'}</h1>
      <p className="text-sm leading-relaxed text-neutral-300">{data?.instructions}</p>
      <p className="text-sm text-neutral-400">Submissions used {data?.submissions_used} of {data?.submissions_allowed}. Status {data?.status}.</p>
      {query.error ? <p className="text-sm text-white">{query.error}</p> : null}
      <ul className="space-y-2 text-sm text-neutral-200">
        {(data?.items ?? []).map((item) => (
          <li key={item.id} className="rounded-2xl border border-white/10 p-3">
            <p>{item.label}{item.required ? '' : ' · optional'}</p>
            <p className="text-neutral-400">{item.status}{item.comment ? ` · ${item.comment}` : ''}</p>
            {item.has_file && item.evidence_id ? (
              <a href={`/academy/practical-files/${item.evidence_id}`} className="text-[#937DFF]">Open screenshot</a>
            ) : null}
          </li>
        ))}
      </ul>
      {canSubmit ? (
        <form action={submitPractical.bind(null, moduleId, practicalId)} className="space-y-4">
          {openItems.map((item) => (
            <fieldset key={item.id} className="space-y-2 rounded-3xl border border-white/10 p-4">
              <input type="hidden" name="item" value={item.id} />
              <p className="text-sm font-semibold">{item.label}</p>
              <label className="block text-sm">
                Evidence
                <select name={`kind-${item.id}`} className="mt-1 w-full rounded-xl border border-white/10 bg-transparent px-3 py-2">
                  <option value="text">Text</option>
                  <option value="link">Link</option>
                  <option value="file">Screenshot</option>
                </select>
              </label>
              <textarea name={`body-${item.id}`} rows={3} placeholder="Text or link" className="w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm" />
              <input name={`file-${item.id}`} type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm" />
            </fieldset>
          ))}
          <button type="submit" className="min-h-11 rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold">Submit</button>
        </form>
      ) : null}
    </div>
  );
}
