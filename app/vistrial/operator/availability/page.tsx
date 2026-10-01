import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { AvailabilityData } from '@/lib/portal/types';
import AvailabilityEditor from '../components/AvailabilityEditor';
import { renderPortal } from '../components/frame';

export const metadata: Metadata = { title: 'Availability' };
export const dynamic = 'force-dynamic';

export default async function AvailabilityPage() {
  const load = await loadPortal<AvailabilityData>('availability', (rpc) => rpc<AvailabilityData>('portal_availability'));
  return renderPortal(load, 'availability', (data) => <AvailabilityEditor data={data} />);
}
