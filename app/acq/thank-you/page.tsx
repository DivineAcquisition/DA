import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { FACEBOOK_DISCLAIMER, THANK_YOU } from '@/lib/acq/copy';
import { CalendarEmbed } from '../components/CalendarEmbed';

export const metadata = {
  title: { absolute: 'Application received | Divine Acquisition' },
  robots: { index: false, follow: false },
};

export default function AcqThankYouPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />

      <div className="relative z-10">
        <header className="px-5 pt-6 sm:px-6 sm:pt-8">
          <div className="mx-auto flex max-w-5xl justify-center">
            <Logo className="h-[20px] w-auto sm:h-[24px]" title="Divine Acquisition" />
          </div>
        </header>

        <section className="px-5 pb-20 pt-12 sm:px-6 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              </svg>
            </div>

            <h1 className="acq-headline animate-rise text-[1.85rem] font-semibold leading-[1.12] sm:text-4xl">
              {THANK_YOU.title}
            </h1>
            <p className="animate-rise delay-1 mx-auto mt-5 max-w-md text-base leading-relaxed text-neutral-400">
              {THANK_YOU.body}
            </p>

            <CalendarEmbed />
          </div>
        </section>

        <footer className="hairline-glow relative border-t border-white/[0.06] px-5 py-10 text-center sm:px-6">
          <p className="text-xs text-neutral-600">© Divine Acquisition. All rights reserved.</p>
          <p className="mx-auto mt-5 max-w-2xl text-[10px] leading-relaxed text-neutral-600 sm:text-[11px]">
            {FACEBOOK_DISCLAIMER}
          </p>
        </footer>
      </div>
    </div>
  );
}
