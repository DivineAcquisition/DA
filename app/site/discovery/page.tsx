import type { Metadata } from 'next';

import { DiscoveryForm } from '../components/discovery-form';
import { FormShell } from '../components/form-shell';
import { Eyebrow } from '../components/primitives';

export const metadata: Metadata = {
  title: { absolute: 'Help Us Understand Your Sales Operation | Divine Acquisition™' },
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ ref?: string | string[] }> };

export default async function DiscoveryPage({ searchParams }: Props) {
  const raw = (await searchParams).ref;
  const ref = typeof raw === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(raw) ? raw : null;

  return (
    <FormShell>
      <div className="mx-auto max-w-3xl">
        <Eyebrow>Pre-discovery questionnaire</Eyebrow>
        <h1 className="da-display da-gradient-text mt-5 text-[2.2rem] leading-[1.05] font-semibold text-balance sm:text-5xl">
          Help Us Understand Your Sales Operation
        </h1>
        <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">
          <p className="text-white/85">The more context we have about your current sales process, the more productive our conversation can be.</p>
          <p>You don’t need perfect numbers. Share what you know, and indicate when a figure is an estimate.</p>
        </div>
        <div className="mt-10">
          <DiscoveryForm inquiryId={ref} />
        </div>
      </div>
    </FormShell>
  );
}
