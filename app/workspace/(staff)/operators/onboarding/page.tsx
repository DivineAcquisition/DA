import type { Metadata } from 'next';
import { listQueue } from '@/lib/operators/desk';
import { DeskHeader, Problem } from '../../components/desk';
import JourneyTable from '../JourneyTable';

export const metadata: Metadata = { title: 'Onboarding' };
export const dynamic = 'force-dynamic';

export default async function OnboardingQueuePage() {
  const { data, error } = await listQueue('onboarding');
  if (!data) return <Problem>{error}</Problem>;
  return (
    <div>
      <DeskHeader
        title="Onboarding"
        description="Invited and onboarding Sales Operators. They fill in the onboarding form in their portal; the file shows progress and the seven readiness items."
      />
      <JourneyTable rows={data} empty="Nobody is onboarding. Advance an applicant to start one." />
    </div>
  );
}
