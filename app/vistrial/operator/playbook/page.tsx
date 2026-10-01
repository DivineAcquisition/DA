import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import { SAMPLE_PLAYBOOK } from '@/lib/portal/sample';
import type { PlaybookData } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import PlaybookView from '../components/PlaybookView';

export const metadata: Metadata = { title: 'Playbook' };
export const dynamic = 'force-dynamic';

function Sample() {
  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-brand-500/30 bg-brand-500/[0.08] px-4 py-3 text-sm text-brand-100">
        Sample data for training. This business does not exist, and nothing here touches a real customer.
      </p>
      <PlaybookView data={SAMPLE_PLAYBOOK} />
    </div>
  );
}

export default async function PlaybookPage() {
  const load = await loadPortal<PlaybookData>('playbook', (rpc, placementId) =>
    placementId
      ? rpc<PlaybookData>('portal_playbook', { p_placement_id: placementId })
      : Promise.resolve({ data: null, error: null }),
  );
  // A trainee gets the sample. The database refuses them any real playbook anyway.
  if (load.kind === 'ready' && load.context.stage === 'training') {
    return renderPortal(load, 'playbook', () => <Sample />, { whenNoData: () => <Sample /> });
  }
  return renderPortal(load, 'playbook', (data) => <PlaybookView data={data} />, { needsPlacement: true });
}
