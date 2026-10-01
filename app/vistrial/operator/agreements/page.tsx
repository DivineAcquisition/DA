import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { ProfileData } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import { AgreementsView } from '../components/MenuViews';

export const metadata: Metadata = { title: 'Agreements' };
export const dynamic = 'force-dynamic';

export default async function AgreementsPage() {
  const load = await loadPortal<ProfileData>('agreements', (rpc) => rpc<ProfileData>('portal_profile'));
  return renderPortal(load, 'agreements', (data) => <AgreementsView data={data} />);
}
