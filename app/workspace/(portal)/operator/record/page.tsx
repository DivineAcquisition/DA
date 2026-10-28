import type { Metadata } from 'next';
import { loadPortal } from '@/lib/portal/load';
import type { ReviewsData } from '@/lib/portal/types';
import { renderPortal } from '../components/frame';
import RecordNav from '../components/RecordNav';
import ReviewsView from '../components/ReviewsView';

export const metadata: Metadata = { title: 'My Record' };
export const dynamic = 'force-dynamic';

export default async function RecordPage({ searchParams }: { searchParams: Promise<{ review?: string }> }) {
  const params = await searchParams;
  const load = await loadPortal<ReviewsData>('record', (rpc, placementId) =>
    placementId
      ? rpc<ReviewsData>('portal_shift_reviews', { p_placement_id: placementId })
      : Promise.resolve({ data: null, error: null }),
  );
  const review = /^\d{4}-\d{2}-\d{2}$/.test(params.review ?? '') ? params.review! : null;
  return renderPortal(
    load,
    'record',
    (data) => (
      <>
        <RecordNav current="record" />
        <ReviewsView data={data} initialDate={review} />
      </>
    ),
    { needsPlacement: true },
  );
}
