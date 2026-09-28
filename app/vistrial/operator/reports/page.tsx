import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { ReportsData } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import ReportsView from '../components/ReportsView';

export const metadata: Metadata = { title: 'Shift Reports' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const load = await loadPortal<ReportsData>('reports', (rpc, placementId) =>
    placementId
      ? rpc<ReportsData>('portal_shift_reports', { p_placement_id: placementId })
      : Promise.resolve({ data: null, error: null }),
  );
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : null;
  return renderPortal(load, 'reports', (data) => <ReportsView data={data} initialDate={date} />, { needsPlacement: true });
}
