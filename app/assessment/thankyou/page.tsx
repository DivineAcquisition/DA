import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { btnPrimary, btnSizeMd, eyebrow } from '@/app/components/ui';
import { markAssessmentUsed } from '@/lib/assessment/actions';
import ThankYouMarker from '../components/ThankYouMarker';

export const dynamic = 'force-dynamic';

export default async function AssessmentThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (token) {
    await markAssessmentUsed(token);
  }

  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />
      <ThankYouMarker tokenFromQuery={token} />
      <div className="relative z-10">
        <header className="border-b border-white/[0.06]">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:h-[72px] sm:px-6">
            <Logo className="h-[22px] w-auto sm:h-[28px]" />
          </div>
        </header>

        <section className="px-5 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
              </svg>
            </div>

            <p className={`${eyebrow} animate-rise`}>You&apos;re booked</p>
            <h1 className="animate-rise delay-1 mt-5 text-[2.1rem] font-semibold leading-[1.08] sm:text-5xl">
              Thank you. <span className="text-gradient">We&apos;ll see you on the call.</span>
            </h1>
            <p className="animate-rise delay-2 mx-auto mt-6 max-w-xl text-base leading-relaxed text-neutral-400">
              Your assessment call is confirmed. You should receive a calendar invite shortly. If
              anything changes, reply to the email that brought you here.
            </p>

            <a
              href="https://divineacquisition.io"
              className={`${btnPrimary} ${btnSizeMd} animate-rise delay-3 mt-10`}
            >
              Back to Divine Acquisition
            </a>
          </div>
        </section>

        <footer className="border-t border-white/[0.06] px-5 py-8 sm:px-6">
          <p className="mx-auto max-w-6xl text-center text-xs text-neutral-600">
            DivineAcquisition™ · Assessment confirmed
          </p>
        </footer>
      </div>
    </div>
  );
}
