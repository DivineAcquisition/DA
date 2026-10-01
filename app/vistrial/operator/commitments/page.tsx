import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { CommitmentsData } from '@/lib/portal/types';
import CommitmentsView from '../components/CommitmentsView';
import { renderPortal } from '../components/frame';

export const metadata: Metadata = { title: "DA's Commitments" };
export const dynamic = 'force-dynamic';

export default async function CommitmentsPage() {
  const load = await loadPortal<CommitmentsData>('commitments', (rpc) => rpc<CommitmentsData>('portal_commitments', {}));
  return renderPortal(load, 'commitments', (data) => <CommitmentsView data={data} />);
}
