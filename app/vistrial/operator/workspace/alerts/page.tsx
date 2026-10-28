import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import type { AlertItem } from '@/lib/sales-workspace/dashboard';
import { createClient } from '@/lib/supabase/server';
import { AlertList } from '../dashboard/parts';
import { brand } from '../WorkspaceFrame';
import { WorkspaceShell } from '../shell';

export const metadata: Metadata = { title: 'Alerts' };
export const dynamic = 'force-dynamic';

type Session = { viewer: { view_as: boolean } | null; time_zone: string | null };

export default async function AlertsPage() {
  const supabase = await createClient();
  const [alerts, session] = await Promise.all([
    controlRpc<AlertItem[]>(supabase, 'so_alerts'),
    controlRpc<Session>(supabase, 'so_session'),
  ]);

  return (
    <WorkspaceShell>
      <Link href="/vistrial/operator/workspace" className="text-sm text-neutral-400 hover:text-white">
        Back to the dashboard
      </Link>
      <h1 className={`${brand.heading} mt-3 text-2xl`}>Alerts</h1>
      <p className="mt-2 text-sm text-neutral-400">Newest first. Read alerts stay here.</p>
      {alerts.error ? <p className="mt-6 text-sm text-[#FFB020]">{readable(alerts.error)}</p> : null}
      {!alerts.error ? (
        <div className="mt-6">
          <AlertList
            alerts={alerts.data ?? []}
            timeZone={session.data?.time_zone ?? 'America/New_York'}
            readOnly={Boolean(session.data?.viewer?.view_as)}
          />
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
