import { BOOK_PAGE, FACEBOOK_DISCLAIMER } from '@/lib/acq/copy';
import { acqCalendarEmbedSrc, trackingFromSearchParams, type SearchParams } from '@/lib/acq/config';
import { CalendarEmbed } from '../components/CalendarEmbed';

export const metadata = {
  title: { absolute: 'Free Sales Audit | Divine Acquisition' },
  robots: { index: false, follow: false },
  alternates: {
    canonical: 'https://acq.divineacquisition.io/book',
  },
};

/** GHL booking calendar for the coaching landing. */
export default async function AcqBookPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const tracking = trackingFromSearchParams(await searchParams);

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
          <CalendarEmbed src={acqCalendarEmbedSrc(tracking)} title="Free sales audit" />
        </div>
      </section>
      <footer className="lx-foot">
        <p>© Divine Acquisition. All rights reserved.</p>
        <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
