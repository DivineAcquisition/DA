import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { EscalationsData } from '@/lib/portal/types';
import EscalationsView from '../components/EscalationsView';
import { renderPortal } from '../components/frame';

export const metadata: Metadata = { title: 'Escalations' };
export const dynamic = 'force-dynamic';

export default async function EscalationsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const params = await searchParams;
  const load = await loadPortal<EscalationsData>('escalations', (rpc, placementId) =>
    placementId
      ? rpc<EscalationsData>('portal_escalations', { p_placement_id: placementId })
      : Promise.resolve({ data: null, error: null }),
  );
  return renderPortal(load, 'escalations', (data) => <EscalationsView data={data} startOpen={params.new === '1'} />, {
    needsPlacement: true,
  });
}
