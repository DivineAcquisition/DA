import type { Metadata } from 'next';
import type { RoutingLog } from '@/lib/ghl/types';
import { Refused, teamRead } from '../../teamRead';
import RoutingView from '../RoutingView';

export const metadata: Metadata = { title: 'Routing log' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await teamRead<RoutingLog>('ghl_routing_log');
  return error || !data ? <Refused error={error ?? 'Not available.'} /> : <RoutingView log={data} />;
}
