import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { SalesEodNav } from '../../components/RecordNav';
import { brand } from '../WorkspaceFrame';
import { WorkspaceShell } from '../shell';
import { EodGuide, loadLaunchCard } from '@/app/components/placement/LaunchWelcome';
import EodForm, { type EodFormData } from './EodForm';

export const metadata: Metadata = { title: 'End of day' };
export const dynamic = 'force-dynamic';

export default async function EodPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  const workDate = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  const supabase = await createClient();
  await controlRpc(supabase, 'so_note_view', { p_tab: 'workspace_eod_form' });
  const [{ data, error }, launch] = await Promise.all([
    controlRpc<EodFormData>(supabase, 'so_eod_form', { p_day: workDate }),
    loadLaunchCard(),
  ]);

  return (
    <WorkspaceShell>
      <SalesEodNav current="today" />
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
        <div className="space-y-4">
          <EodGuide show={Boolean(launch?.show_guide)} />
          <EodForm data={data} />
        </div>
      )}
    </WorkspaceShell>
  );
}
