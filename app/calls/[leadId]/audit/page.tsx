import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { PageHeader } from '@/app/vistrial/components/ui';
import { isRecordId } from '@/lib/calls/cells';
import { todayInCallsZone } from '@/lib/calls/map';
import { getLeadProfile } from '@/lib/calls/queries';
import AuditForm from '../../components/AuditForm';
import CallBrief from '../../components/CallBrief';

export default async function LeadAuditPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  if (!isRecordId(leadId)) notFound();
  const profile = await getLeadProfile(leadId);
  if (!profile) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Lead Leak Audit"
        title="Debrief this call"
        description="Same fields as the Airtable form, grouped the same way. The debrief lands in Supabase first, then is sent to Call Debriefs. Save a draft mid-call. Mark complete only when Outcome, Agreed Next Step, and Deal Risk are filled."
        actions={
          <Link href={`/calls/${leadId}`} className={`${btnSecondary} ${btnSizeSm}`}>
            Profile
          </Link>
        }
      />
      <CallBrief lead={profile.lead} history={profile.history} />
      <AuditForm lead={profile.lead} incomingCall={profile.incomingCall} today={todayInCallsZone()} />
    </div>
  );
}
