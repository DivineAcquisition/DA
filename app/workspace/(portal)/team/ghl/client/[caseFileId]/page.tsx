import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { CaseDetail, PlacementOption } from '@/lib/ghl/types';
import { Refused, teamRead } from '../../../teamRead';
import ClientView from '../../ClientView';

export const metadata: Metadata = { title: 'Client GHL' };
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ caseFileId: string }> }) {
  const { caseFileId } = await params;
  const [detail, placements] = await Promise.all([
    teamRead<CaseDetail>('ghl_case_file_detail', { p_case_file_id: caseFileId }),
    teamRead<PlacementOption[]>('ghl_case_file_placements', { p_case_file_id: caseFileId }),
  ]);
  if (detail.error || !detail.data) return <Refused error={detail.error ?? 'Not available.'} />;
  // The webhook address GHL posts to: this deploy's own origin.
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return <ClientView detail={detail.data} placements={placements.data ?? []} origin={host ? `${proto}://${host}` : ''} />;
}
