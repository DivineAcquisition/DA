import { EmptyState } from '@/app/vistrial/components/ui';
import OnboardForm from '@/app/calls/components/OnboardForm';
import { callsConfigured } from '@/lib/calls/config';
import { clientBaseUrl, conversionFrom, onboardCta, onboardPrefillFrom } from '@/lib/calls/conversion';
import { isSignedOnboardToken, isTestLeadName, readOnboardToken } from '@/lib/calls/onboard-token';
import { getLeadProfile } from '@/lib/calls/queries';

export default async function PublicOnboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { token } = await params;
  const { saved } = await searchParams;
  const rawToken = decodeURIComponent(token);
  const leadId = readOnboardToken(rawToken);

  if (!leadId) {
    return (
      <EmptyState title="This link is not valid" detail="Ask for a new onboarding link from Divine Acquisition." />
    );
  }

  if (!callsConfigured()) {
    return <EmptyState title="Temporarily unavailable" detail="Try again in a few minutes." />;
  }

  const profile = await getLeadProfile(leadId);
  if (!profile) {
    return (
      <EmptyState title="This link is not valid" detail="Ask for a new onboarding link from Divine Acquisition." />
    );
  }

  if (!isSignedOnboardToken(rawToken) && !isTestLeadName(profile.lead.fullName)) {
    return (
      <EmptyState title="This link is not valid" detail="Ask for a new onboarding link from Divine Acquisition." />
    );
  }

  const conversion = conversionFrom(profile);
  const cta = onboardCta(conversion);

  if (cta.kind === 'client-base') {
    return (
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">Client</p>
        <h1 className="text-2xl font-semibold">Your operating base is ready</h1>
        <p className="text-sm">
          <a
            href={clientBaseUrl(cta.base.id)}
            className="text-brand-300 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {cta.base.name || 'Open your Airtable base'}
          </a>
        </p>
      </div>
    );
  }

  if (saved === '1' || profile.onboarding) {
    return (
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">Onboarding</p>
        <h1 className="text-2xl font-semibold">Received</h1>
        <p className="text-sm leading-relaxed text-neutral-400">
          Thanks{profile.lead.fullName ? `, ${profile.lead.fullName}` : ''}. We’ll use this to stand up
          your operating system. Nothing here writes back over the sales record.
        </p>
      </div>
    );
  }

  if (cta.kind !== 'start') {
    return (
      <EmptyState
        title="Onboarding is not open yet"
        detail="This form opens after the audit is Closed Won and payment has cleared."
      />
    );
  }

  const prefill = onboardPrefillFrom(profile);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">Onboarding</p>
        <h1 className="mt-2 text-2xl font-semibold">
          {profile.lead.companyName || profile.lead.fullName || 'Your install'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          We already have what the audit captured. Fill in CRM access, admin logins, database size,
          and training times. The rest is here so you do not re-type it.
        </p>
      </div>
      <OnboardForm leadId={leadId} token={token} prefill={prefill} />
    </div>
  );
}
