import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { InboxItem } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import { InboxView } from '../components/MenuViews';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const load = await loadPortal<InboxItem[]>('inbox', (rpc) => rpc<InboxItem[]>('portal_inbox'));
  return renderPortal(load, 'inbox', (data) => <InboxView items={data} />);
}
