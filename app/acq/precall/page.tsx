import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { Particles } from '@/components/ui/particles';
import { ACQ_PRECALL_WISTIA_MEDIA_ID } from '@/lib/acq/config';
import { FACEBOOK_DISCLAIMER, PRECALL } from '@/lib/acq/copy';
import HeroVideo from '../components/HeroVideo';
import { StatusPill, StepCards } from '../components/marketing';

export const metadata = {
  title: { absolute: 'Your audit is confirmed | Divine Acquisition' },
  description: PRECALL.body,
  alternates: {
    canonical: 'https://acq.divineacquisition.io/precall',
  },
  robots: { index: false, follow: false },
};

export default function AcqPrecallPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />

      <div className="relative z-10">
        <div className="relative overflow-hidden">
          <Particles
            className="absolute inset-0 z-0"
            quantity={48}
            color="#9A88FC"
            ease={80}
            size={0.5}
          />
          <header className="relative z-10 px-5 pt-6 sm:px-6 sm:pt-8">
            <div className="mx-auto flex max-w-5xl flex-col items-center">
              <Logo className="h-[20px] w-auto sm:h-[24px]" title="Divine Acquisition" />
              <div className="acq-headline animate-rise mt-6">
                <StatusPill>{PRECALL.eyebrow}</StatusPill>
              </div>
            </div>
          </header>

          <section className="relative z-10 px-5 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-10 md:pt-12">
            <div className="mx-auto max-w-[900px] text-center">
              <h1 className="acq-headline animate-rise delay-1 mx-auto max-w-[34rem] text-[1.65rem] font-semibold leading-[1.14] tracking-tight text-white sm:text-[2.2rem] md:text-[2.55rem] md:leading-[1.1]">
                {PRECALL.titleBefore}
                <em className="acq-headline-accent">{PRECALL.titleAccent}</em>
              </h1>
              <p className="animate-rise delay-2 mx-auto mt-5 max-w-[34rem] text-sm leading-relaxed text-neutral-400 sm:mt-6 sm:text-[15px]">
                {PRECALL.body}
              </p>
            </div>
          </section>
        </div>

        <section className="px-5 pb-16 sm:px-6 sm:pb-20">
          <HeroVideo mediaId={ACQ_PRECALL_WISTIA_MEDIA_ID} contentName="Precall Audit Briefing" />
        </section>

        <section className="hairline-glow relative border-t border-white/[0.06] px-5 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <div className="max-w-2xl">
              <StatusPill>{PRECALL.stepsEyebrow}</StatusPill>
              <h2 className="acq-headline mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {PRECALL.stepsTitle}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-[15px]">
                {PRECALL.stepsBody}
              </p>
            </div>
            <StepCards items={PRECALL.steps} />
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
