import type { Metadata } from 'next';
import type { AccessOverview } from '@/lib/ghl/types';
import { Refused, teamRead } from '../../teamRead';
import AccessView from '../AccessView';

export const metadata: Metadata = { title: 'GHL access' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await teamRead<AccessOverview>('ghl_access_overview');
  return error || !data ? <Refused error={error ?? 'Not available.'} /> : <AccessView data={data} />;
}
