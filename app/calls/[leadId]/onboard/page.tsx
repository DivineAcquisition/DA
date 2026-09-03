import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { EmptyState, PageHeader } from '@/app/vistrial/components/ui';
import CopyOnboardLink from '../../components/CopyOnboardLink';
import OnboardForm from '../../components/OnboardForm';
import { isRecordId } from '@/lib/calls/cells';
import { onboardAbsoluteUrl } from '@/lib/calls/config';
import { clientBaseUrl, conversionFrom, onboardCta, onboardPrefillFrom } from '@/lib/calls/conversion';
import { signOnboardToken } from '@/lib/calls/onboard-token';
import { getLeadProfile } from '@/lib/calls/queries';

export default async function LeadOnboardPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  if (!isRecordId(leadId)) notFound();

  const profile = await getLeadProfile(leadId);
  if (!profile) notFound();

  const conversion = conversionFrom(profile);
  const cta = onboardCta(conversion);
  const host = (await headers()).get('x-vistrial-host');
  const token = signOnboardToken(leadId);
  const publicUrl = token ? onboardAbsoluteUrl(token, host) : '';

  if (cta.kind === 'none') {
    return (
      <EmptyState
        title="Not converted"
        detail="Onboarding starts after an audit debrief is submitted with Outcome = Closed Won."
      />
    );
  }

  if (cta.kind === 'waiting-payment') {
    return (
      <EmptyState
        title="Waiting on Commas"
        detail="Closed Won is on this profile. Confirm payment from the profile — this form does not open until Payment Status is Paid."
      />
    );
  }

  if (cta.kind === 'client-base') {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Client"
          title={profile.lead.fullName}
          description="Onboarding already has an operating base. The prospect profile stays here."
          actions={
            <Link href={`/calls/${leadId}`} className={`${btnSecondary} ${btnSizeSm}`}>
              Profile
            </Link>
          }
        />
        <p className="text-sm">
          <a
            href={clientBaseUrl(cta.base.id)}
            className="text-brand-300 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {cta.base.name || 'Open client base'}
          </a>
        </p>
      </div>
    );
  }

  const prefill = onboardPrefillFrom(profile);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Onboarding"
        title={`Start onboarding — ${profile.lead.fullName || 'lead'}`}
        description="Pre-filled from the live lead and the closing debrief. CRM, admin logins, database size, and training stay blank. Submitting writes the Client Onboarding table, not the lead."
        actions={
          <Link href={`/calls/${leadId}`} className={`${btnSecondary} ${btnSizeSm}`}>
            Profile
          </Link>
        }
      />
      {publicUrl ? <CopyOnboardLink url={publicUrl} /> : null}
      <OnboardForm leadId={leadId} token={token || undefined} prefill={prefill} />
    </div>
  );
}
