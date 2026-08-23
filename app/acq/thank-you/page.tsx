import Logo from '@/app/components/Logo';
import { FACEBOOK_DISCLAIMER, THANK_YOU } from '@/lib/acq/copy';
import AcqBackdrop from '../components/AcqBackdrop';
import { ThankYouConversion } from '../components/MetaPixel';

export const metadata = {
  title: { absolute: 'Application received | Divine Acquisition' },
  robots: { index: false, follow: false },
};

export default function AcqThankYouPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <ThankYouConversion />
      <AcqBackdrop />

      <div className="relative z-10">
        <header className="border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-5 sm:h-16 sm:px-6">
            <Logo className="h-[18px] w-auto sm:h-[20px]" title="Divine Acquisition" />
          </div>
        </header>

        <section className="px-5 pb-24 pt-20 sm:px-6 sm:pt-28">
          <div className="mx-auto max-w-lg rounded-3xl border border-white/[0.07] bg-white/[0.02] px-6 py-14 text-center sm:px-10">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/25">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              </svg>
            </div>
            <p className="text-[13px] font-medium text-neutral-500">Application received</p>
            <h1 className="acq-headline mt-3 text-[1.65rem] font-semibold leading-[1.15] sm:text-[2rem]">
              {THANK_YOU.title}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-neutral-400">
              {THANK_YOU.body}
            </p>
          </div>
        </section>

        <footer className="border-t border-white/[0.06] px-5 py-10 text-center sm:px-6">
          <p className="text-xs text-neutral-600">© Divine Acquisition. All rights reserved.</p>
          <p className="mx-auto mt-5 max-w-2xl text-[10px] leading-relaxed text-neutral-600 sm:text-[11px]">
            {FACEBOOK_DISCLAIMER}
          </p>
        </footer>
      </div>
    </div>
  );
}
