import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { PlaybookData } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import PlaybookView from '../components/PlaybookView';

export const metadata: Metadata = { title: 'Playbook' };
export const dynamic = 'force-dynamic';

export default async function PlaybookPage() {
  const load = await loadPortal<PlaybookData>('playbook', (rpc, placementId) =>
    placementId
      ? rpc<PlaybookData>('portal_playbook', { p_placement_id: placementId })
      : Promise.resolve({ data: null, error: null }),
  );
  return renderPortal(load, 'playbook', (data) => <PlaybookView data={data} />, { needsPlacement: true });
}
