import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { GrowthData } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import GrowthView from '../components/GrowthView';
import { GrowthNav } from '../components/RecordNav';

export const metadata: Metadata = { title: 'Pay & Growth' };
export const dynamic = 'force-dynamic';

export default async function GrowthPage() {
  const load = await loadPortal<GrowthData>('growth', (rpc) => rpc<GrowthData>('portal_growth'));
  return renderPortal(load, 'growth', (data) => (
    <>
      <GrowthNav current="growth" />
      <GrowthView data={data} />
    </>
  ));
}
