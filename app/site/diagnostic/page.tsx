import type { Metadata } from 'next';

import { SALES_OPS } from '@/lib/site/content';

import { DiagnosticForm } from '../components/diagnostic-form';
import { FormShell } from '../components/form-shell';
import { Eyebrow } from '../components/primitives';

export const metadata: Metadata = {
  title: { absolute: 'Request Your Sales Operations Diagnostic | Divine Acquisition™' },
  description: 'Tell us about your business and the challenges affecting your sales process. We’ll review it and determine the appropriate next step.',
  alternates: { canonical: '/diagnostic' },
};

const STEPS = [
  { title: 'Tell us about your business', body: 'This form. A few minutes.' },
  { title: 'Choose a time', body: 'Book your diagnostic on our calendar.' },
  { title: 'Share your business context', body: 'A short questionnaire before the call, so the conversation is productive.' },
];

export default function DiagnosticPage() {
  return (
    <FormShell>
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <aside className="lg:sticky lg:top-10 lg:self-start">
          <Eyebrow>{SALES_OPS.name}</Eyebrow>
          <h1 className="da-display da-gradient-text mt-5 text-[2.2rem] leading-[1.05] font-semibold text-balance sm:text-5xl">
            Request Your Sales Operations Diagnostic
          </h1>
          <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">
            <p className="text-white/85">Tell us about your business and the challenges affecting your sales process.</p>
            <p>We’ll review your information to understand where improvements may be needed and determine the appropriate next step.</p>
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
        <DiagnosticForm />
      </div>
    </FormShell>
  );
}
