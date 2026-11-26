import type { Metadata } from 'next';

import { Eyebrow, shell } from '@/app/site/components/primitives';
import { ROOFING } from '@/lib/acq/niche-content';
import { nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';

import { RoofingBackdrop, RoofingFooter, RoofingFormHeader, roofingPaths } from '../chrome';
import { RoofingApplyForm } from './RoofingApplyForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: ROOFING.apply.meta.title },
  description: ROOFING.apply.meta.description,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: 'https://acq.divineacquisition.io/roofing/apply' },
};

export default async function RoofingApplyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const content = ROOFING;
  const tracking = nicheTrackingFromSearch(await searchParams);
  const { landing } = await roofingPaths(tracking);

  return (
    <>
      <div className="relative min-h-screen overflow-hidden">
        <RoofingBackdrop />
        <RoofingFormHeader home={landing} back={content.apply.back} />
        <main className={`${shell} relative pt-8 pb-24 sm:pt-14`}>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <aside className="lg:sticky lg:top-10 lg:self-start">
              <Eyebrow>{content.apply.eyebrow}</Eyebrow>
              <h1 className="da-display da-gradient-text mt-5 text-[2.2rem] leading-[1.05] font-semibold text-balance sm:text-5xl">
                {content.form.heading}
              </h1>
              <p className="mt-6 text-[15px] leading-relaxed text-white/85 sm:text-base">{content.apply.lead}</p>
              <ol className="mt-8 space-y-3">
                {content.apply.steps.map((step, index) => (
                  <li key={step.title} className="flex gap-4 rounded-xl border border-[#9a88fc]/15 bg-[#16131f] p-4">
                    <span
                      className={`da-mono flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] ${index === 0 ? 'bg-[#5a23fc] text-white' : 'bg-[#251f36] text-white/55'}`}
                    >
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-white">{step.title}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-white/50">{step.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </aside>
            <RoofingApplyForm niche={content.id} form={content.form} tracking={tracking} nextNote={content.apply.nextNote} />
          </div>
        </main>
      </div>
      <RoofingFooter links={[{ href: landing, label: content.apply.back }]} />
    </>
  );
}
