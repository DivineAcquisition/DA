import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { PlaybookData } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import PlaybookView from '../components/PlaybookView';

export const metadata: Metadata = { title: 'Playbook' };
export const dynamic = 'force-dynamic';

/**
 * Training simulation (Agreement 3.2): invented, non-live data from the
 * separate training store, served only to a VA in the training stage and
 * always labelled. It never reaches a live screen, report, metric, pay or GHL.
 */
function TrainingSimulation({ data }: { data: PlaybookData | null }) {
  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-brand-500/30 bg-brand-500/[0.08] px-4 py-3 text-sm text-brand-100">
        Training simulation. This business does not exist, and nothing here touches a real customer.
      </p>
      {data ? <PlaybookView data={data} /> : <p className="text-sm text-neutral-500">The training simulation is not available yet. Ask your trainer.</p>}
    </div>
  );
}

export default async function PlaybookPage() {
  const load = await loadPortal<PlaybookData>('playbook', (rpc, placementId) =>
    placementId
      ? rpc<PlaybookData>('portal_playbook', { p_placement_id: placementId })
      : Promise.resolve({ data: null, error: null }),
  );
  if (load.kind === 'ready' && load.context.stage === 'training') {
    const training = await loadPortal<PlaybookData>('playbook', (rpc) => rpc<PlaybookData>('portal_training_playbook'));
    const simulation = training.kind === 'ready' ? training.data : null;
    return renderPortal(load, 'playbook', () => <TrainingSimulation data={simulation} />, {
      whenNoData: () => <TrainingSimulation data={simulation} />,
    });
  }
  return renderPortal(load, 'playbook', (data) => <PlaybookView data={data} />, { needsPlacement: true });
}
