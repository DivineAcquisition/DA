import type { Metadata } from 'next';
import type { AvailabilityRow } from '@/lib/team/types';
import MatchingView from '../MatchingView';
import { Refused, teamRead } from '../teamRead';

export const metadata: Metadata = { title: "Availability" };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await teamRead<AvailabilityRow[]>('staff_availability');
  return (
    <>
      {error || !data ? <Refused error={error ?? 'Not available.'} /> : <MatchingView rows={data} />}
    </>
  );
}
