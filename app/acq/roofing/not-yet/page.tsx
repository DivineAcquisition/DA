import type { Metadata } from 'next';

import { VisitCapture } from '@/app/acq/components/niche/NicheExperience';
import { shell } from '@/app/site/components/primitives';
import { ROOFING } from '@/lib/acq/niche-content';
import { nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';

import { RoofingBackdrop, RoofingFooter, RoofingFormHeader, roofingPaths } from '../chrome';

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
  const { landing } = await roofingPaths(tracking);

  return (
    <>
      <VisitCapture tracking={tracking} />
      <div className="relative min-h-[70vh] overflow-hidden">
        <RoofingBackdrop />
        <RoofingFormHeader home={landing} back={ROOFING.apply.back} />
        <main className={`${shell} relative pt-16 pb-24 sm:pt-24`}>
          <div className="da-panel-violet mx-auto max-w-2xl rounded-[28px] p-8 text-center sm:p-12">
            <h1 className="da-display da-gradient-text text-[2.4rem] leading-[1.05] font-semibold sm:text-5xl">{ROOFING.notYet.title}</h1>
            <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-white/80 sm:text-lg">{ROOFING.notYet.body}</p>
          </div>
        </main>
      </div>
      <RoofingFooter />
    </>
  );
}
