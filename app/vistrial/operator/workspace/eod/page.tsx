import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc } from '@/lib/ad/rpc';
import { formatDate } from '@/lib/portal/time';
import { createClient } from '@/lib/supabase/server';
import { brand, StatePanel } from '../WorkspaceFrame';
import { WorkspaceShell } from '../shell';

export const metadata: Metadata = { title: 'End of day' };
export const dynamic = 'force-dynamic';

/** Placeholder until the EOD form is built. No fields, no submit. */
export default async function EodSoonPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  const supabase = await createClient();
  await controlRpc(supabase, 'so_note_view', { p_tab: 'workspace_eod_form' });
  const when = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? formatDate(day, true) : null;

  return (
    <WorkspaceShell>
      <StatePanel
        eyebrow="End of day"
        title="The EOD form is coming soon."
        body={
          when
            ? `This report is for ${when}. The form is the next step. Nothing is submitted from this screen.`
            : 'The form is the next step. Nothing is submitted from this screen.'
        }
        action={
          <Link href="/vistrial/operator/workspace" className={brand.primaryButton}>
            Back to the dashboard
          </Link>
        }
      />
    </WorkspaceShell>
  );
}
