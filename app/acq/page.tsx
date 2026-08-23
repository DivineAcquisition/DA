import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { trackingFromSearchParams, type SearchParams } from '@/lib/acq/config';
import { FACEBOOK_DISCLAIMER, HEADLINE, SUBHEADLINE } from '@/lib/acq/copy';
import HeroVideo from './components/HeroVideo';
import { QualifyButton, QualifyProvider } from './components/QualifyGate';

export default async function AcqLandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const tracking = trackingFromSearchParams(query);

  return (
    <QualifyProvider tracking={tracking}>
      <div className="min-h-screen bg-ink-950 text-white antialiased">
        <Backdrop />

        <div className="relative z-10">
          <header className="px-5 pt-6 sm:px-6 sm:pt-8">
            <div className="mx-auto flex max-w-5xl justify-center">
              <Logo className="h-[20px] w-auto sm:h-[24px]" title="Divine Acquisition" />
            </div>
          </header>

          <section className="px-5 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-14 md:pt-16">
            <div className="mx-auto max-w-[900px] text-center">
              <h1 className="acq-headline animate-rise delay-1 mx-auto max-w-[920px] text-[1.45rem] font-semibold leading-[1.16] tracking-tight text-white sm:text-[2.05rem] md:text-[2.4rem] md:leading-[1.12]">
                {HEADLINE}
              </h1>

              <p className="animate-rise delay-2 mx-auto mt-4 max-w-[34rem] text-sm leading-relaxed text-neutral-400 sm:mt-5 sm:text-[15px]">
                {SUBHEADLINE}
              </p>
            </div>
          </section>

          <section className="px-5 pb-20 sm:px-6 sm:pb-24">
            <HeroVideo />

            <div className="animate-rise delay-4 mx-auto mt-9 flex max-w-[900px] flex-col items-center">
              <QualifyButton />
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
    </QualifyProvider>
  );
}
