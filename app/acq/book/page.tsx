import { BOOK_PAGE, FACEBOOK_DISCLAIMER } from '@/lib/acq/copy';
import IclosedEmbed from '../components/IclosedEmbed';

export const metadata = {
  title: { absolute: 'Free Sales Audit | Divine Acquisition' },
  robots: { index: false, follow: false },
  alternates: {
    canonical: 'https://acq.divineacquisition.io/book',
  },
};

/** iClosed booking calendar for the landing CTA. */
export default function AcqBookPage() {
  return (
    <div className="acq-coaches min-h-screen antialiased">
      <section className="lx-hero">
        <div className="lx-wrap lx-hero-inner">
          <p className="lx-pill">{BOOK_PAGE.eyebrow}</p>
          <h1 className="lx-headline">
            {BOOK_PAGE.titleBefore}
            <span className="lx-accent">{BOOK_PAGE.titleAccent}</span>
          </h1>
          <p className="lx-lead">{BOOK_PAGE.body}</p>
          <IclosedEmbed />
        </div>
      </section>
      <footer className="lx-foot">
        <p>© Divine Acquisition. All rights reserved.</p>
        <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
