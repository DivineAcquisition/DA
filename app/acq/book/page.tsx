import { cookies } from 'next/headers';
import { BOOK_PAGE, FACEBOOK_DISCLAIMER } from '@/lib/acq/copy';
import { ACQ_ICLOSED_TITLE, trackingFromSearchParams, type SearchParams } from '@/lib/acq/config';
import { revenueLeakEmbedUrl } from '@/lib/acq/revenue-leak';
import { REVENUE_LEAK } from '@/lib/acq/revenue-leak-content';
import IclosedEmbed from '../components/IclosedEmbed';

export const metadata = {
  title: { absolute: 'Free Sales Audit | Divine Acquisition' },
  robots: { index: false, follow: false },
  alternates: {
    canonical: 'https://acq.divineacquisition.io/book',
  },
};

/** iClosed booking calendar for the coaching landing. Same event as the local-service audit. */
export default async function AcqBookPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const tracking = trackingFromSearchParams(await searchParams);
  const jar = await cookies();
  const src = revenueLeakEmbedUrl(REVENUE_LEAK.booking.url, tracking, {
    fbp: jar.get('_fbp')?.value,
    fbc: jar.get('_fbc')?.value,
  });

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
          <IclosedEmbed
            url={src}
            title={ACQ_ICLOSED_TITLE}
            contentName="Free Sales Audit"
            contentCategory="coaching"
            eventName="Schedule"
          />
        </div>
      </section>
      <footer className="lx-foot">
        <p>© Divine Acquisition. All rights reserved.</p>
        <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
