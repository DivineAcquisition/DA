import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { loadPortal } from '@/lib/portal/load';
import type { ReportsData } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import ReportsView from '../components/ReportsView';
import RecordNav from '../components/RecordNav';

export const metadata: Metadata = { title: 'Shift Reports' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const load = await loadPortal<ReportsData>('reports', (rpc, placementId) =>
    placementId
      ? rpc<ReportsData>('portal_shift_reports', { p_placement_id: placementId })
      : Promise.resolve({ data: null, error: null }),
  );
  if (load.kind === 'ready' && load.context.sales_operator) redirect('/workspace/operator/workspace/eod');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : null;
  return renderPortal(load, 'reports', (data) => (
    <>
      <RecordNav current="reports" />
      <ReportsView data={data} initialDate={date} />
    </>
  ), { needsPlacement: true });
}
