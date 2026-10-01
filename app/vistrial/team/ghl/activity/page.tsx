import type { Metadata } from 'next';
import type { ActivityHealth } from '@/lib/ghl/types';
import { Refused, teamRead } from '../../teamRead';
import ActivityView from '../ActivityView';

export const metadata: Metadata = { title: 'Activity health' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await teamRead<ActivityHealth>('ghl_activity_health');
  return error || !data ? <Refused error={error ?? 'Not available.'} /> : <ActivityView rows={data} />;
}
