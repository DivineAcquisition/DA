import type { Metadata } from 'next';
import type { Queues } from '@/lib/team/types';
import QueuesView from '../QueuesView';
import TeamNav from '../TeamNav';
import { Refused, teamRead } from '../teamRead';

export const metadata: Metadata = { title: "Queues" };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data, error } = await teamRead<Queues>('staff_queues');
  return (
    <>
      <TeamNav />
      {error || !data ? <Refused error={error ?? 'Not available.'} /> : <QueuesView queues={data} />}
    </>
  );
}
