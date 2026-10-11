import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Backdrop from '@/app/components/Backdrop';
import { clientFromHeaders, loadAgreementPage } from '@/lib/workspace/agreement-page';
import { loadSignerSignFields } from '@/lib/workspace/sign-agreement';
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
  const signFields = page.state === 'open' ? await loadSignerSignFields(token) : { signature: [], initials: [] };

  // A newer version for the same person that is still open: go straight there.
  if (page.state === 'superseded' && page.redirectToken) {
    redirect(`/s/${encodeURIComponent(page.redirectToken)}`);
  }

  return (
    <div className="da-workspace da-sign relative min-h-screen">
      <Backdrop />
      <div className="relative z-10 px-5 py-8 sm:px-8 sm:py-16">
        <AgreementView token={token} initial={page} signFields={signFields} />
      </div>
    </div>
  );
}
