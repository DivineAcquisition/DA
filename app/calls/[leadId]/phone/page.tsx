import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { PageHeader } from '@/app/vistrial/components/ui';
import { isRecordId } from '@/lib/calls/cells';
import { getLeadProfile } from '@/lib/calls/queries';
import CallBrief from '../../components/CallBrief';
import PhoneForm from '../../components/PhoneForm';

export default async function LeadPhonePage({
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
        eyebrow="Phone touch"
        title="Log a call, SMS, or voicemail"
        description="The brief first. Then the same fields as the Log Touch form. Submitting writes one Touches record and brings you back to the profile."
        actions={
          <Link href={`/calls/${leadId}`} className={`${btnSecondary} ${btnSizeSm}`}>
            Profile
          </Link>
        }
      />
      <CallBrief lead={profile.lead} history={profile.history} />
      <PhoneForm lead={profile.lead} />
    </div>
  );
}
