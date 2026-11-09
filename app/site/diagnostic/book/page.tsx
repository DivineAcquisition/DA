import type { Metadata } from 'next';
import Script from 'next/script';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

import { ACQ_CALENDAR_EMBED_SCRIPT, ACQ_CALENDAR_IFRAME_ID } from '@/lib/acq/config';
import { CONTACT_EMAIL, DIAGNOSTIC_PATH, DISCOVERY_PATH } from '@/lib/site/content';
import { diagnosticCalendarUrl } from '@/lib/site/inquiry';

import { FormShell } from '../../components/form-shell';
import { Eyebrow } from '../../components/primitives';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Book Your Sales Operations Diagnostic | Divine Acquisition™' },
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ ref?: string | string[] }> };

export default async function BookDiagnosticPage({ searchParams }: Props) {
  const raw = (await searchParams).ref;
  const ref = typeof raw === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(raw) ? raw : null;
  const calendar = diagnosticCalendarUrl();
  const discoveryHref = ref ? `${DISCOVERY_PATH}?ref=${encodeURIComponent(ref)}` : DISCOVERY_PATH;

  return (
    <FormShell>
      <div className="mx-auto max-w-4xl text-center">
        {ref ? (
          <p className="inline-flex items-center gap-2 rounded-full border border-[#52d6a4]/30 bg-[#52d6a4]/10 px-4 py-1.5 text-sm text-[#a7f3d0]">
            <CheckCircle2 className="size-4" aria-hidden /> Your request has been received.
          </p>
        ) : (
          <Eyebrow className="justify-center">Sales Operations Diagnostic</Eyebrow>
        )}
        <h1 className="da-display da-gradient-text mt-6 text-[2.2rem] leading-[1.05] font-semibold text-balance sm:text-5xl">
          Choose a Time for Your Diagnostic
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">
          {ref
            ? 'Pick a time that works for you. Your booking is confirmed once the calendar shows the confirmation.'
            : 'If you haven’t told us about your business yet, start with the short request form so we can prepare.'}
        </p>
        {!ref ? (
          <a href={DIAGNOSTIC_PATH} className="da-btn-primary mt-6 inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium text-white">
            <span className="relative z-[1]">Request your diagnostic</span>
          </a>
        ) : null}
      </div>

      {calendar ? (
        <div className="relative mx-auto mt-10 max-w-4xl">
          <div aria-hidden className="absolute inset-x-6 -bottom-6 top-8 rounded-[2rem] bg-[#5a23fc]/30 blur-3xl" />
          <div className="relative overflow-hidden rounded-3xl border border-[#9a88fc]/20 bg-black p-1.5 sm:p-2">
            <iframe
              id={ACQ_CALENDAR_IFRAME_ID}
              src={calendar}
              title="Book your Sales Operations Diagnostic"
              className="h-[720px] w-full rounded-[1.25rem] border-0 bg-black"
            />
          </div>
          <Script src={ACQ_CALENDAR_EMBED_SCRIPT} strategy="afterInteractive" />
        </div>
      ) : (
        <div role="status" className="da-panel-violet mx-auto mt-10 max-w-2xl rounded-2xl p-8 text-center">
          <p className="text-[15px] leading-relaxed text-white/75">
            Online booking isn’t available right now. We’ll reply by email to arrange a time. You can also write to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#c3b6fe] underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      )}

      <div className="da-panel mx-auto mt-10 flex max-w-4xl flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="da-mono text-[10px] tracking-[0.18em] text-[#b59aff] uppercase">After you book</p>
          <p className="mt-2 text-[15px] leading-relaxed text-white/80">
            Help us prepare by sharing how your sales process works today. Estimates are fine.
          </p>
        </div>
        <a
          href={discoveryHref}
          className="da-btn-ghost inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium text-white"
        >
          Share your business context
          <ArrowRight className="size-4" aria-hidden />
        </a>
      </div>
    </FormShell>
  );
}
