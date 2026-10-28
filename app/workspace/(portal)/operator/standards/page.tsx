import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { StandardsData } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import StandardsView from '../components/StandardsView';

export const metadata: Metadata = { title: 'My Standards' };
export const dynamic = 'force-dynamic';

function monthStart(offset: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  return d.toISOString().slice(0, 10);
}

export default async function StandardsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams;
  const months = [monthStart(0), monthStart(1), monthStart(2)];
  const month = months.includes(params.month ?? '') ? params.month! : months[0];
  const load = await loadPortal<StandardsData>('standards', (rpc) => rpc<StandardsData>('portal_standards', { p_month: month }));
  return renderPortal(load, 'standards', (data) => <StandardsView data={data} month={month} months={months} />);
}
