import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { TodayData } from '@/lib/portal/types';
import { renderPortal } from './components/frame';
import TodayView from './components/TodayView';

export const metadata: Metadata = { title: 'Today' };
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const load = await loadPortal<TodayData>('today', (rpc, placementId) =>
    placementId ? rpc<TodayData>('portal_today', { p_placement_id: placementId }) : Promise.resolve({ data: null, error: null }),
  );
  return renderPortal(load, 'today', (data) => <TodayView data={data} />);
}
