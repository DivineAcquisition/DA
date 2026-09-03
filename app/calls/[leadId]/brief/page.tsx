import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { PageHeader } from '@/app/vistrial/components/ui';
import { isRecordId } from '@/lib/calls/cells';
import { getLeadProfile } from '@/lib/calls/queries';
import CallBrief from '../../components/CallBrief';

export default async function CallBriefPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  if (!isRecordId(leadId)) notFound();
  const profile = await getLeadProfile(leadId);
  if (!profile) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Before you dial"
        title="Call brief"
        description="Everything in front of you thirty seconds before the call. One editable note. Everything else is live from Airtable."
        actions={
          <>
            <Link href={`/calls/${leadId}`} className={`${btnSecondary} ${btnSizeSm}`}>
              Profile
            </Link>
            <Link href={`/calls/${leadId}/phone`} className={`${btnSecondary} ${btnSizeSm}`}>
              Log phone
            </Link>
            <Link href={`/calls/${leadId}/audit`} className={`${btnPrimary} ${btnSizeSm}`}>
              Log audit
            </Link>
          </>
        }
      />
      <CallBrief lead={profile.lead} history={profile.history} />
    </>
  );
}
