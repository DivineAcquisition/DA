import type { Metadata } from 'next';
import { ClientCard } from '../components/SalesHome';
import { WorkNav } from '../components/RecordNav';
import { renderPortal } from '../components/frame';
import { loadPortal } from '@/lib/portal/load';

export const metadata: Metadata = { title: 'Client' };
export const dynamic = 'force-dynamic';

/** The short client card. Name, shift, days, and time zone. Nothing else about the account. */
export default async function ClientPage() {
  const load = await loadPortal<null>('client');
  return renderPortal(load, 'client', (_data, placementId, context) => (
    <>
      {context.sales_operator ? <WorkNav current="client" /> : null}
      <ClientCard placementId={placementId} />
    </>
  ));
}
