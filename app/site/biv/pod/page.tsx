import type { Metadata } from 'next';

import { FormShell } from '../../components/form-shell';
import { PodcastForm } from '../../components/podcast-form';
import { Eyebrow } from '../../components/primitives';

export const metadata: Metadata = {
  title: { absolute: 'Book a 1-on-1 with Malik | Divine Acquisition™' },
  description: 'Heard the podcast? Tell us about your business and how sales run today, then choose a time for a 1-on-1 call.',
  alternates: { canonical: '/biv/pod' },
  // A link shared on the podcast, not a page for search.
  robots: { index: false, follow: true },
};

const STEPS = [
  { title: 'Tell us about your business', body: 'This form. About ten minutes, so the call can start on substance.' },
  { title: 'Choose a time', body: 'Pick a slot on the calendar right after.' },
  { title: 'Talk 1-on-1', body: 'We go through your sales process and where it can improve.' },
];

export default function PodcastPage() {
  return (
    <FormShell>
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <aside className="lg:sticky lg:top-10 lg:self-start">
          <Eyebrow>From the podcast</Eyebrow>
          <h1 className="da-display da-gradient-text mt-5 text-[2.2rem] leading-[1.05] text-balance sm:text-5xl">
            Book a <span className="whitespace-nowrap">1-on-1</span> with Malik
          </h1>
          <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">
            <p className="text-white/85">Thanks for listening. If something on the show hit close to home, let’s talk about your business.</p>
            <p>Answer a few questions about how sales work today. We read every answer before the call, so the time goes to what matters.</p>
          </div>
          <ol className="mt-8 space-y-3">
            {STEPS.map((step, index) => (
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
        <PodcastForm />
      </div>
    </FormShell>
  );
}
