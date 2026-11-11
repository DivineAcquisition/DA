import type { Metadata } from 'next';
import Script from 'next/script';
import { CheckCircle2 } from 'lucide-react';

import { ACQ_CALENDAR_EMBED_SCRIPT, ACQ_CALENDAR_IFRAME_ID } from '@/lib/acq/config';
import { CONTACT_EMAIL, PODCAST_PATH } from '@/lib/site/content';
import { podcastCalendarUrl } from '@/lib/site/inquiry';

import { FormShell } from '../../../components/form-shell';
import { Eyebrow } from '../../../components/primitives';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Choose a Time for Your 1-on-1 | Divine Acquisition™' },
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ ref?: string | string[] }> };

export default async function BookPodcastPage({ searchParams }: Props) {
  const raw = (await searchParams).ref;
  const ref = typeof raw === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(raw) ? raw : null;
  const calendar = podcastCalendarUrl();

  return (
    <FormShell>
      <div className="mx-auto max-w-4xl text-center">
        {ref ? (
          <p className="inline-flex items-center gap-2 rounded-full border border-[#52d6a4]/30 bg-[#52d6a4]/10 px-4 py-1.5 text-sm text-[#a7f3d0]">
            <CheckCircle2 className="size-4" aria-hidden /> Your answers have been received.
          </p>
        ) : (
          <Eyebrow className="justify-center">From the podcast</Eyebrow>
        )}
        <h1 className="da-display da-gradient-text mt-6 text-[2.2rem] leading-[1.05] text-balance sm:text-5xl">
          Choose a Time for Your <span className="whitespace-nowrap">1-on-1</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">
          {ref
            ? 'Pick a time that works for you. Your call is confirmed once the calendar shows the confirmation.'
            : 'Start with the short form so we can prepare for the call.'}
        </p>
        {!ref ? (
          <a href={PODCAST_PATH} className="da-btn-primary mt-6 inline-flex h-11 items-center rounded-xl px-5 text-sm font-medium text-white">
            <span className="relative z-[1]">Tell us about your business</span>
          </a>
        ) : null}
      </div>

      {ref && calendar ? (
        <div className="relative mx-auto mt-10 max-w-4xl">
          <div aria-hidden className="absolute inset-x-6 -bottom-6 top-8 rounded-[2rem] bg-[#5a23fc]/30 blur-3xl" />
          <div className="relative overflow-hidden rounded-3xl border border-[#9a88fc]/20 bg-black p-1.5 sm:p-2">
            <iframe id={ACQ_CALENDAR_IFRAME_ID} src={calendar} title="Book your 1-on-1" className="h-[720px] w-full rounded-[1.25rem] border-0 bg-black" />
          </div>
          <Script src={ACQ_CALENDAR_EMBED_SCRIPT} strategy="afterInteractive" />
        </div>
      ) : ref ? (
        <div role="status" className="da-panel-violet mx-auto mt-10 max-w-2xl rounded-2xl p-8 text-center">
          <p className="text-[15px] leading-relaxed text-white/75">
            Online booking isn’t available right now. We’ll reply by email to set a time. You can also write to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#c3b6fe] underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      ) : null}
    </FormShell>
  );
}
