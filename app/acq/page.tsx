import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { eyebrow } from '@/app/components/ui';
import BookCallButton from './components/BookCallButton';
import PilotVideo from './components/PilotVideo';

const FACEBOOK_DISCLAIMER =
  'This site is not a part of the Facebook website or Facebook Inc. Additionally, this site is NOT endorsed by Facebook in any way. FACEBOOK is a trademark of META PLATFORMS, Inc.';

const LEGAL_LINKS = [
  { label: 'Terms', href: '/acq/terms' },
  { label: 'Disclaimer', href: '/acq/disclaimer' },
  { label: 'Privacy Policy', href: '/acq/privacy' },
] as const;

export default function AcqLandingPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />

      <div className="relative z-10">
        {/* 2.1 Top banner: pinned above the logo, not dismissible */}
        <div className="sticky top-0 z-50 bg-brand-500 px-4 py-2.5 text-center">
          <p className="text-[11px] font-bold uppercase leading-snug tracking-[0.08em] text-ink-950 sm:text-xs sm:tracking-[0.12em]">
            Pilot program · Performance only · You pay per booked appointment
          </p>
        </div>

        {/* 2.2 Header: logo only, not a link, no nav */}
        <header className="px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="mx-auto max-w-5xl">
            <Logo className="h-[20px] w-auto sm:h-[24px]" title="Divine Acquisition" />
          </div>
        </header>

        {/* Hero: pill, headline, sub, CTA */}
        <section className="px-5 pb-6 pt-10 sm:px-6 sm:pb-8 sm:pt-14 md:pt-16">
          <div className="mx-auto max-w-[900px] text-center">
            {/* 2.3 ICP pill: callout, not interactive */}
            <p className={`${eyebrow} animate-rise pointer-events-none select-none`}>
              For service businesses at $30k+/month
            </p>

            {/* 2.4 Headline */}
            <h1 className="animate-rise delay-1 mx-auto mt-6 max-w-[900px] text-[1.85rem] font-bold leading-[1.12] text-white sm:text-4xl md:text-[2.75rem] md:leading-[1.08]">
              We help service businesses 2-3x their client intake without hiring by automating sales
              conversion and repetitive tasks.
            </h1>

            {/* 2.5 Sub description: free build + pay per booked appointment */}
            <p className="animate-rise delay-2 mx-auto mt-6 max-w-[640px] text-base leading-relaxed text-neutral-400 sm:text-[17px]">
              We install a sales operation that answers every lead in under 60 seconds, follows up
              until they book, and brings back the customers you already have. You pay nothing to
              build it and nothing to run it. You only pay for the appointments we book.
            </p>

            {/* 2.6 Sole CTA */}
            <div className="animate-rise delay-3 mt-9 flex flex-col items-center">
              <BookCallButton />
              <p className="mt-3 text-xs text-neutral-500 sm:text-[13px]">
                Limited availability. Performance only.
              </p>
            </div>
          </div>
        </section>

        {/* 2.7 Video + Facebook disclaimer (always visible) */}
        <section className="px-5 pb-14 sm:px-6 sm:pb-20">
          <PilotVideo />

          <p className="mx-auto mt-6 max-w-2xl text-center text-[10px] leading-relaxed text-neutral-600 sm:text-[11px]">
            {FACEBOOK_DISCLAIMER}
          </p>
        </section>

        {/* 2.8 Footer */}
        <footer className="hairline-glow relative border-t border-white/[0.06] px-5 py-10 text-center sm:px-6">
          <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-neutral-500">
            {LEGAL_LINKS.map((link, index) => (
              <span key={link.href} className="contents">
                {index > 0 && (
                  <span aria-hidden className="text-neutral-700">
                    ·
                  </span>
                )}
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-brand-300"
                >
                  {link.label}
                </a>
              </span>
            ))}
          </nav>
          <p className="mt-4 text-xs text-neutral-600">© Divine Acquisition. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
