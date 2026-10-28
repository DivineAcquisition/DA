import type { Metadata } from 'next';
import type { Overview } from '@/lib/ghl/types';
import { Refused, teamRead } from '../teamRead';
import ConnectionsView from './ConnectionsView';

export const metadata: Metadata = { title: 'GHL connections' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await teamRead<Overview>('ghl_overview');
  return error || !data ? <Refused error={error ?? 'Not available.'} /> : <ConnectionsView overview={data} />;
}
