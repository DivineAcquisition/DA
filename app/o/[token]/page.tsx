import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Backdrop from '@/app/components/Backdrop';
import { clientFromHeaders, loadAgreementPage } from '@/lib/workspace/agreement-page';
import { loadOnboardingPage } from '@/lib/workspace/onboarding';
import { VA_SALES_OPERATOR_AGREEMENT } from '@/lib/workspace/onboarding-protocol';
import OnboardingView, { type OnboardingSigning } from './OnboardingView';

export const dynamic = 'force-dynamic';

// The link is the credential: never indexed, never passed on as a Referer.
export const metadata: Metadata = {
  title: 'Onboarding · Divine Acquisition',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = clientFromHeaders(await headers());
  let page = await loadOnboardingPage(token, client);
  let signing: OnboardingSigning | null = null;

  if (page.state === 'sign_first' && page.agreementToken) {
    const agreement = await loadAgreementPage(page.agreementToken, client);
    if (agreement.state === 'completed') {
      page = await loadOnboardingPage(token, client);
    } else if (agreement.state === 'open' && agreement.embedSrc) {
      signing = {
        agreementToken: page.agreementToken,
        embedSrc: agreement.embedSrc,
        email: agreement.email,
        name: agreement.recipientName || page.recipientName,
        templateName: agreement.templateName || VA_SALES_OPERATOR_AGREEMENT.name,
        personalized: true,
      };
    }
  }

  return (
    <div className="da-workspace relative min-h-screen">
      <Backdrop />
      <div className="relative z-10 px-4 py-6 sm:px-6 sm:py-10">
        <OnboardingView token={token} initial={page} signing={signing} />
      </div>
    </div>
  );
}
