import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { brand } from '../WorkspaceFrame';
import { WorkspaceShell } from '../shell';
import EodForm, { type EodFormData } from './EodForm';

export const metadata: Metadata = { title: 'End of day' };
export const dynamic = 'force-dynamic';

export default async function EodPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  const workDate = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  const supabase = await createClient();
  await controlRpc(supabase, 'so_note_view', { p_tab: 'workspace_eod_form' });
  const { data, error } = await controlRpc<EodFormData>(supabase, 'so_eod_form', { p_day: workDate });

  return (
    <WorkspaceShell>
      {error || !data ? (
        <section className={brand.panel}>
          <p className={brand.eyebrow}>End of day</p>
          <h1 className={`${brand.heading} mt-2 text-2xl`}>The report could not open.</h1>
          <p className="mt-3 text-sm text-neutral-300">{error ? readable(error) : 'Nothing came back.'}</p>
          <Link href="/workspace/operator/workspace" className={`${brand.primaryButton} mt-6`}>
            Back to the dashboard
          </Link>
        </section>
      ) : (
        <EodForm data={data} />
      )}
    </WorkspaceShell>
  );
}
