import type { Metadata } from 'next';
import { FrontOfficeFooter } from '@/app/acq/components/niche/FrontOfficeLanding';
import { VisitCapture } from '@/app/acq/components/niche/NicheExperience';
import { SHARED_FRONT_OFFICE } from '@/lib/acq/front-office-content';
import { nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: `${SHARED_FRONT_OFFICE.notYet.title} | Divine Acquisition` },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: 'https://acq.divineacquisition.io/ai/not-yet' },
};

export default async function FrontOfficeNotYetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tracking = nicheTrackingFromSearch(await searchParams);

  return (
    <div className="acq-coaches acq-niche acq-niche-ai min-h-screen antialiased">
      <VisitCapture tracking={tracking} />
      <section className="lx-hero">
        <div className="lx-wrap lx-hero-inner">
          <h1 className="lx-headline">{SHARED_FRONT_OFFICE.notYet.title}</h1>
          <p className="lx-lead">{SHARED_FRONT_OFFICE.notYet.body}</p>
        </div>
      </section>
      <FrontOfficeFooter />
    </div>
  );
}
