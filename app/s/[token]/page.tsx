import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Backdrop from '@/app/components/Backdrop';
import { clientFromHeaders, loadAgreementPage } from '@/lib/workspace/agreement-page';
import AgreementView from './AgreementView';

export const dynamic = 'force-dynamic';

// A signing link is a credential: never indexed, and never passed on in a
// Referer header when the recipient clicks out.
export const metadata: Metadata = {
  title: 'Your agreement · Divine Acquisition',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

export default async function AgreementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await loadAgreementPage(token, clientFromHeaders(await headers()));

  // A newer version for the same person that is still open: go straight there.
  if (page.state === 'superseded' && page.redirectToken) {
    redirect(`/s/${encodeURIComponent(page.redirectToken)}`);
  }

  return (
    <div className="da-workspace relative min-h-screen">
      <Backdrop />
      <div className="relative z-10 px-4 py-6 sm:px-6 sm:py-10">
        <AgreementView token={token} initial={page} />
      </div>
    </div>
  );
}
