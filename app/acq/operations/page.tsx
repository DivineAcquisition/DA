import type { Metadata } from 'next';
import { CircleCheck } from 'lucide-react';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { DotPattern } from '@/components/ui/dot-pattern';
import { ShineBorder } from '@/components/ui/shine-border';
import { FACEBOOK_DISCLAIMER, LEGAL_DISCLAIMER_URL, LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import { nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';
import { SALES_REVIEW, SALES_REVIEW_URL } from '@/lib/acq/sales-review';
import { ReviewForm } from './ReviewForm';

export const metadata: Metadata = {
  title: { absolute: SALES_REVIEW.meta.title },
  description: SALES_REVIEW.meta.description,
  alternates: { canonical: SALES_REVIEW_URL },
  openGraph: {
    title: SALES_REVIEW.meta.title,
    description: SALES_REVIEW.meta.description,
    url: SALES_REVIEW_URL,
    siteName: 'Divine Acquisition',
  },
};

export default async function SalesOperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const visit = nicheTrackingFromSearch(await searchParams);

  return (
    <div className="acq-coaches acq-operations min-h-screen antialiased">
      <header className="ops-bar">
        <p className="ops-mark">Divine Acquisition</p>
      </header>

      <section className="lx-hero relative overflow-hidden">
        <DotPattern
          className="pointer-events-none absolute inset-0 text-[rgba(154,136,252,0.45)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
          width={22}
          height={22}
          cr={1}
        />
        <div className="lx-wrap lx-hero-inner relative z-[1]">
          <p className="lx-pill">
            <AnimatedShinyText className="mx-0 max-w-none text-inherit">{SALES_REVIEW.pill}</AnimatedShinyText>
          </p>
          <h1 className="lx-headline">
            {SALES_REVIEW.headlineBefore}
            <span className="lx-accent">{SALES_REVIEW.headlineAccent}</span>
          </h1>
          <p className="lx-qualifier">{SALES_REVIEW.lead}</p>
          <p className="lx-lead">{SALES_REVIEW.support}</p>
          <a className="acq-button" href="#review">
            {SALES_REVIEW.cta}
          </a>
          <p className="ops-aside">{SALES_REVIEW.builtAround}</p>
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap">
          <p className="ops-kicker">{SALES_REVIEW.solve.eyebrow}</p>
          <h2 className="lx-heading">{SALES_REVIEW.solve.title}</h2>
          <p className="ops-intro">{SALES_REVIEW.solve.intro}</p>
          <ul className="ops-grid">
            {SALES_REVIEW.solve.items.map((item) => (
              <li key={item.title} className="lx-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="ops-close">{SALES_REVIEW.solve.close}</p>
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap">
          <p className="ops-kicker">{SALES_REVIEW.implement.eyebrow}</p>
          <h2 className="lx-heading">{SALES_REVIEW.implement.title}</h2>
          <ol className="ops-grid">
            {SALES_REVIEW.implement.items.map((item) => (
              <li key={item.index} className="lx-card">
                <span className="ops-index">{item.index}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap">
          <p className="ops-kicker">{SALES_REVIEW.approach.eyebrow}</p>
          <h2 className="lx-heading">{SALES_REVIEW.approach.title}</h2>
          <ol className="ops-grid">
            {SALES_REVIEW.approach.items.map((item) => (
              <li key={item.index} className="lx-card">
                <span className="ops-index">{item.index}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap">
          <p className="ops-kicker">{SALES_REVIEW.who.eyebrow}</p>
          <h2 className="lx-heading">{SALES_REVIEW.who.title}</h2>
          <p className="ops-intro">{SALES_REVIEW.who.intro}</p>
          <ul className="ops-checks">
            {SALES_REVIEW.who.points.map((point) => (
              <li key={point}>
                <CircleCheck aria-hidden />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="ops-close">{SALES_REVIEW.who.close}</p>
        </div>
      </section>

      <section className="lx-section" id="review">
        <div className="lx-wrap lx-hero-inner">
          <p className="ops-kicker">{SALES_REVIEW.close.eyebrow}</p>
          <h2 className="lx-heading">{SALES_REVIEW.close.title}</h2>
          <p className="lx-lead">{SALES_REVIEW.close.body}</p>
          <p className="ops-aside">{SALES_REVIEW.close.outline}</p>
          <div className="ops-panel">
            <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} borderWidth={1} />
            <ReviewForm visit={visit} />
          </div>
        </div>
      </section>

      <footer className="lx-foot">
        <p>© Divine Acquisition. All rights reserved.</p>
        <p>
          <a href={LEGAL_TERMS_URL}>Terms</a>
          {' · '}
          <a href={LEGAL_PRIVACY_URL}>Privacy</a>
          {' · '}
          <a href={LEGAL_DISCLAIMER_URL}>Disclaimer</a>
        </p>
        <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
