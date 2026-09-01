import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { BOOK_PAGE, FACEBOOK_DISCLAIMER } from '@/lib/acq/copy';
import { CalendarEmbed } from '../components/CalendarEmbed';

export const metadata = {
  title: { absolute: 'Free Sales Audit | Divine Acquisition' },
  robots: { index: false, follow: false },
  alternates: {
    canonical: 'https://acq.divineacquisition.io/book',
  },
};

/** GHL booking calendar for the landing CTA. */
export default function AcqBookPage() {
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
            <p className="acq-headline text-[11px] font-semibold tracking-tight text-brand-300">
              {BOOK_PAGE.eyebrow}
            </p>
            <h1 className="acq-headline animate-rise mt-3 text-[1.85rem] font-semibold leading-[1.12] sm:text-4xl">
              {BOOK_PAGE.titleBefore}
              <em className="acq-headline-accent">{BOOK_PAGE.titleAccent}</em>
            </h1>
            <p className="animate-rise delay-1 mx-auto mt-5 max-w-md text-base leading-relaxed text-neutral-400">
              {BOOK_PAGE.body}
            </p>
          </div>

          <CalendarEmbed />
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
