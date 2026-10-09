import { FACEBOOK_DISCLAIMER, LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import { VisitCapture } from '@/app/acq/components/niche/NicheExperience';
import { ROOFING } from '@/lib/acq/niche-content';
import { nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Lead Leak Audit | Divine Acquisition' },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: 'https://acq.divineacquisition.io/roofing/not-yet' },
};

export default async function RoofingNotYetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tracking = nicheTrackingFromSearch(await searchParams);

  return (
    <div className="acq-coaches acq-niche min-h-screen antialiased">
      <VisitCapture tracking={tracking} />
      <section className="lx-hero">
        <div className="lx-wrap lx-hero-inner">
          <h1 className="lx-headline">{ROOFING.notYet.title}</h1>
          <p className="lx-lead">{ROOFING.notYet.body}</p>
        </div>
      </section>
      <footer className="lx-foot">
        <p>
          © Divine Acquisition. All rights reserved. <a href={LEGAL_TERMS_URL}>Terms</a>
          {' · '}
          <a href={LEGAL_PRIVACY_URL}>Privacy</a>
        </p>
        <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
