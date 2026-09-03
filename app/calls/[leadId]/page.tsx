import { notFound } from 'next/navigation';
import { EmptyState } from '@/app/vistrial/components/ui';
import { isRecordId } from '@/lib/calls/cells';
import { callsReady } from '@/lib/calls/config';
import { getLeadProfile } from '@/lib/calls/queries';
import ProfileView from '../components/ProfileView';

export default async function LeadProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { leadId } = await params;
  const { saved } = await searchParams;
  if (!isRecordId(leadId)) notFound();
  if (!(await callsReady())) {
    return (
      <EmptyState
        title="Airtable is not configured"
        detail="Set da_settings.pipeline_airtable_pat to read this lead live from DA Pipeline."
      />
    );
  }

  const profile = await getLeadProfile(leadId);
  if (!profile) notFound();

  return <ProfileView profile={profile} saved={saved} />;
}
