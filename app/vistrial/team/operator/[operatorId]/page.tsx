import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/supabase/server';
import type { FeedbackContext, StaffNotice, StaffReview, StaffStandards } from '@/lib/team/types';
import OperatorAccountability from '../../OperatorAccountability';
import TeamNav from '../../TeamNav';
import { Refused, teamRead } from '../../teamRead';

export const metadata: Metadata = { title: 'Operator' };
export const dynamic = 'force-dynamic';

export default async function OperatorPage({ params }: { params: Promise<{ operatorId: string }> }) {
  const { operatorId } = await params;
  const [session, standards, reviews, feedback, notices] = await Promise.all([
    getSessionContext(),
    teamRead<StaffStandards>('staff_standards', { p_operator_id: operatorId }),
    teamRead<StaffReview[]>('staff_shift_reviews', { p_operator_id: operatorId }),
    teamRead<FeedbackContext>('staff_feedback_context', { p_operator_id: operatorId }),
    teamRead<StaffNotice[]>('staff_formal_notices', { p_operator_id: operatorId }),
  ]);
  return (
    <>
      <TeamNav />
      {standards.error || !standards.data ? (
        <Refused error={standards.error ?? 'Not available.'} />
      ) : (
        <OperatorAccountability
          standards={standards.data}
          reviews={reviews.data ?? []}
          feedback={feedback.data}
          notices={notices.data ?? []}
          canAdmin={Boolean(session?.isAdmin)}
          viewer={session?.fullName ?? session?.email ?? 'you'}
        />
      )}
    </>
  );
}
