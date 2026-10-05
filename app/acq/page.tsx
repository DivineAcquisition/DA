import { trackingFromSearchParams, type SearchParams } from '@/lib/acq/config';
import {
  AUDIENCE,
  BUILD,
  CLOSING,
  COST,
  FACEBOOK_DISCLAIMER,
  FAQ,
  HEADLINE_ACCENT,
  HEADLINE_AFTER,
  HEADLINE_BEFORE,
  HOW_IT_WORKS,
  LANDING_QUALIFIER,
  LANDING_TRUST,
  PILL_BANNER,
  PROBLEM,
  SUBHEADLINE,
} from '@/lib/acq/copy';
import HeroVideo from './components/HeroVideo';
import { QualifyButton, QualifyProvider } from './components/QualifyGate';

function Check() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden>
      <path d="m4 10 4 4 8-8" />
    </svg>
  );
}

export default async function AcqLandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const tracking = trackingFromSearchParams(query);

  return (
    <QualifyProvider tracking={tracking}>
      <div className="acq-coaches min-h-screen antialiased">
        <section className="lx-hero">
          <div className="lx-wrap lx-hero-inner">
            <p className="lx-pill">{PILL_BANNER}</p>
            <h1 className="lx-headline">
              {HEADLINE_BEFORE}
              <span className="lx-accent">{HEADLINE_ACCENT}</span>
              {HEADLINE_AFTER}
            </h1>
            <p className="lx-lead">{SUBHEADLINE}</p>
            <p className="lx-requirement">{LANDING_QUALIFIER}</p>
            <HeroVideo shell />
            <QualifyButton />
            <ul className="lx-trust">
              {LANDING_TRUST.map((item) => (
                <li key={item}>
                  <Check />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap">
            <h2 className="lx-heading">{PROBLEM.eyebrow}</h2>
            <p className="lx-intro">{PROBLEM.body}</p>
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap">
            <h2 className="lx-heading">{COST.eyebrow}</h2>
            <p className="lx-intro">{COST.body}</p>
            <ul className="lx-patterns">
              {COST.items.map((item, index) => (
                <li key={item.title} className="lx-card lx-pattern">
                  <span className="lx-num">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
            <div className="lx-close">
              <h3>{COST.closeTitle}</h3>
              <p>{COST.closeBody}</p>
            </div>
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap">
            <h2 className="lx-heading">{BUILD.eyebrow}</h2>
            <ul className="lx-offer">
              {BUILD.items.map((item, index) => (
                <li key={item.title} className={index === 1 ? 'lx-card lx-featured' : 'lx-card'}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
            <p className="lx-callout">
              <strong>Installed in fourteen days.</strong> Then the call shows you where the leads are dying, for free.
            </p>
            <div className="lx-center">
              <QualifyButton />
            </div>
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap">
            <h2 className="lx-heading">{HOW_IT_WORKS.eyebrow}</h2>
            <ol className="lx-steps">
              {HOW_IT_WORKS.steps.map((step, index) => (
                <li key={step.label} className="lx-card">
                  <span className="lx-num lx-num-brand">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3>{step.label}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap">
            <h2 className="lx-heading">{AUDIENCE.eyebrow}</h2>
            <ul className="lx-audience">
              <li className="lx-card lx-featured">
                <h3>A fit</h3>
                <p>{AUDIENCE.fit}</p>
              </li>
              <li className="lx-card">
                <h3>Not a fit</h3>
                <p>{AUDIENCE.notFit}</p>
              </li>
            </ul>
            <div className="lx-center">
              <QualifyButton />
            </div>
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap">
            <h2 className="lx-heading">{FAQ.eyebrow}</h2>
            <div className="lx-faq">
              {FAQ.items.map((item) => (
                <details key={item.question}>
                  <summary>
                    <span>{item.question}</span>
                    <span className="lx-plus" aria-hidden />
                  </summary>
                  <p className="lx-answer">{item.answer}</p>
                </details>
              ))}
            </div>
            <div className="lx-center">
              <QualifyButton />
            </div>
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap lx-hero-inner">
            <h2 className="lx-heading">{CLOSING.title}</h2>
            <p className="lx-lead">{CLOSING.note}</p>
            <QualifyButton />
          </div>
        </section>

        <footer className="lx-foot">
          <p>© Divine Acquisition. All rights reserved.</p>
          <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
        </footer>
      </div>
    </QualifyProvider>
  );
}
