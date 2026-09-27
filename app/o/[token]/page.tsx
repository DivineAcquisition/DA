import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Backdrop from '@/app/components/Backdrop';
import { clientFromHeaders } from '@/lib/workspace/agreement-page';
import { loadOnboardingPage } from '@/lib/workspace/onboarding';
import OnboardingView from './OnboardingView';

export const dynamic = 'force-dynamic';

// The link is the credential: never indexed, never passed on as a Referer.
export const metadata: Metadata = {
  title: 'Onboarding · Divine Acquisition',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await loadOnboardingPage(token, clientFromHeaders(await headers()));

  return (
    <div className="da-workspace relative min-h-screen">
      <Backdrop />
      <div className="relative z-10 px-4 py-6 sm:px-6 sm:py-10">
        <OnboardingView token={token} initial={page} />
      </div>
    </div>
  );
}
