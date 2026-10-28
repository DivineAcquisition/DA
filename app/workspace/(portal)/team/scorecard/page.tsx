import type { Metadata } from 'next';
import type { Scorecard } from '@/lib/team/types';
import ScorecardView from '../ScorecardView';
import TeamNav from '../TeamNav';
import { Refused, teamRead } from '../teamRead';

export const metadata: Metadata = { title: "DA's scorecard" };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await teamRead<Scorecard>('staff_da_scorecard');
  return (
    <>
      <TeamNav />
      {error || !data ? <Refused error={error ?? 'Not available.'} /> : <ScorecardView data={data} />}
    </>
  );
}
