import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { BookingsData } from '@/lib/portal/types';
import BookingsView from '../components/BookingsView';
import { renderPortal } from '../components/frame';

export const metadata: Metadata = { title: 'Bookings' };
export const dynamic = 'force-dynamic';

const STATES = new Set(['confirmed', 'pending_review', 'rejected', 'system_only']);

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ month?: string; state?: string }> }) {
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? '') ? `${params.month}-01` : null;
  const state = STATES.has(params.state ?? '') ? params.state! : null;

  const load = await loadPortal<BookingsData>('bookings', (rpc, placementId) =>
    placementId
      ? rpc<BookingsData>('portal_bookings', { p_placement_id: placementId, p_month: month, p_state: state })
      : Promise.resolve({ data: null, error: null }),
  );
  return renderPortal(load, 'bookings', (data) => <BookingsView data={data} state={state} />, { needsPlacement: true });
}
