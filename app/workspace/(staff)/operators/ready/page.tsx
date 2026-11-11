import type { Metadata } from 'next';
import { listQueue } from '@/lib/operators/desk';
import { DeskHeader, Problem } from '../../components/desk';
import JourneyTable from '../JourneyTable';

export const metadata: Metadata = { title: 'Ready' };
export const dynamic = 'force-dynamic';

export default async function ReadyQueuePage() {
  const { data, error } = await listQueue('ready');
  if (!data) return <Problem>{error}</Problem>;
  return (
    <div>
      <DeskHeader
        title="Ready to place"
        description="Every readiness item is met or waived. Place opens the placement wizard with this operator chosen."
      />
      <JourneyTable rows={data} ready empty="Nobody is ready yet. Operators move here when all seven readiness items are met or waived." />
    </div>
  );
}
