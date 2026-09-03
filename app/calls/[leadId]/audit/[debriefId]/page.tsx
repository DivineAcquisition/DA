import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { PageHeader } from '@/app/vistrial/components/ui';
import { isRecordId } from '@/lib/calls/cells';
import { todayInCallsZone } from '@/lib/calls/map';
import { getDebrief, getLeadProfile } from '@/lib/calls/queries';
import AuditForm from '../../../components/AuditForm';
import CallBrief from '../../../components/CallBrief';

export default async function ContinueAuditPage({
  params,
}: {
  params: Promise<{ leadId: string; debriefId: string }>;
}) {
  const { leadId, debriefId } = await params;
  if (!isRecordId(leadId) || !isRecordId(debriefId)) notFound();
  const [profile, debrief] = await Promise.all([getLeadProfile(leadId), getDebrief(debriefId)]);
  if (!profile || !debrief || !debrief.leadIds.includes(leadId)) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={debrief.complete ? 'Edit debrief' : 'Continue draft'}
        title={debrief.title || profile.lead.fullName}
        description="This is the same Call Debriefs record. Finishing it patches through Supabase, then Airtable — it does not create a duplicate."
        actions={
          <Link href={`/calls/${leadId}`} className={`${btnSecondary} ${btnSizeSm}`}>
            Profile
          </Link>
        }
      />
      <CallBrief lead={profile.lead} history={profile.history} />
      <AuditForm
        lead={profile.lead}
        debrief={debrief}
        incomingCall={profile.incomingCall}
        today={todayInCallsZone()}
      />
    </div>
  );
}
