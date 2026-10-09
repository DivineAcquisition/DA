import { FACEBOOK_DISCLAIMER, LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import {
  headlineFor,
  offerFoot,
  renderedFaqs,
  renderedOffer,
  renderedSteps,
  sourceMark,
  type NicheContent,
} from '@/lib/acq/niche-content';
import type { HeadlineVariant, NicheVisit } from '@/lib/acq/niche-tracking';
import { Check, NicheQuotes, NicheVideo, ProblemIcon } from './blocks';
import { NicheFaq } from './NicheFaq';
import { NicheCta, NicheExperience, NicheMark } from './NicheExperience';

function Cta() {
  return (
    <div className="lx-center">
      <NicheCta />
    </div>
  );
}

export function NicheLanding({
  content,
  variant,
  tracking,
}: {
  content: NicheContent;
  variant: HeadlineVariant;
  tracking: NicheVisit;
}) {
  const steps = renderedSteps(content);
  const offer = renderedOffer(content);
  const faqs = renderedFaqs(content);

  return (
    <NicheExperience button={content.button} form={content.form} variant={variant} tracking={tracking}>
      <section className="lx-hero">
        <div className="lx-wrap lx-hero-inner">
          <p className="lx-pill">{content.pill}</p>
          <h1 className="lx-headline" data-headline={variant}>
            {headlineFor(content, variant)}
          </h1>
          <p className="lx-lead">
            {content.subhead.map((span) => (
              <span key={span.text}>
                {span.text}
                {span.sourceIds?.length ? (
                  <a className="niche-source-mark" href="#sources">
                    <span className="niche-sr">Sources </span>
                    {sourceMark(content, span.sourceIds)}
                  </a>
                ) : null}
              </span>
            ))}
          </p>
          <NicheVideo video={content.video} />
          <NicheCta mark="hero" />
          <ul className="niche-chips">
            {content.chips.map((chip) => (
              <li key={chip}>{chip}</li>
            ))}
          </ul>
          <p className="niche-quiet">{content.quietLine}</p>
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <h2 className="lx-heading">{content.statsHeading}</h2>
          <ul className="niche-stats">
            {content.stats.map((stat) => (
              <li key={stat.value} className="lx-card niche-stat">
                <strong>{stat.value}</strong>
                <span className="niche-stat-label">{stat.label}</span>
                <small>{stat.source}</small>
              </li>
            ))}
          </ul>
          <p className="niche-foot-line">{content.statsFoot}</p>
          <Cta />
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <p className="niche-eyebrow">{content.problem.eyebrow}</p>
          <h2 className="lx-heading">{content.problem.heading}</h2>
          <p className="lx-intro niche-body">{content.problem.body}</p>
          <h3 className="niche-subhead">{content.problem.placesHeading}</h3>
          <ul className="niche-places">
            {content.problem.places.map((place) => (
              <li key={place.title} className="lx-card">
                <ProblemIcon name={place.icon} />
                <h4>{place.title}</h4>
                <p>{place.text}</p>
              </li>
            ))}
          </ul>
          <p className="niche-closing">{content.problem.closing}</p>
          <div className="mt-6">
            <NicheQuotes quotes={content.quotes} />
          </div>
          <Cta />
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <h2 className="lx-heading">{content.need.heading}</h2>
          <ul className="niche-needs">
            {content.need.items.map((item, index) => (
              <li key={item.title} className="lx-card">
                <span className="niche-check-num">{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
          <p className="niche-foot-line">{content.need.foot}</p>
          <Cta />
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <p className="niche-eyebrow">{content.offer.eyebrow}</p>
          <h2 className="lx-heading">{content.offer.heading}</h2>
          <ul className="niche-offer">
            {offer.map((item) => (
              <li key={item.title}>
                <details className="lx-card niche-piece">
                  <summary>
                    <span className="niche-piece-head">
                      <h3>{item.title}</h3>
                      <span className="lx-plus" aria-hidden />
                    </span>
                    <p className="niche-done">
                      <strong>Done when:</strong> {item.done}
                    </p>
                  </summary>
                  <ul className="niche-bullets">
                    {item.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
          <p className="lx-callout">{offerFoot(content)}</p>
          <Cta />
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <h2 className="lx-heading">{content.why.heading}</h2>
          <p className="lx-intro niche-body">{content.why.body}</p>
          <ol className="niche-checks">
            {content.why.checks.map((line, index) => (
              <li key={line}>
                <span className="niche-check-num">{index + 1}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <p className="niche-after">{content.why.after}</p>
          <ul className="niche-commits">
            {content.commitments.map((line) => (
              <li key={line} className="lx-card niche-commit">
                <Check />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <article className="lx-card lx-featured niche-proof">
            <p className="niche-kicker">{content.proof.label}</p>
            <p>{content.proof.text}</p>
            <p className="niche-honesty">{content.proof.honesty}</p>
          </article>
          <Cta />
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <h2 className="lx-heading">{content.fitHeading}</h2>
          <ul className="lx-audience">
            <li className="lx-card lx-featured">
              <h3>{content.fit.title}</h3>
              <p>{content.fit.text}</p>
            </li>
            <li className="lx-card">
              <h3>{content.notFit.title}</h3>
              <p>{content.notFit.text}</p>
            </li>
          </ul>
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <h2 className="lx-heading">{content.stepsHeading}</h2>
          <ol className="niche-steps-list">
            {steps.map((step, index) => (
              <li key={step.title} className="lx-card">
                <span className="niche-step-num">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <Cta />
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <h2 className="lx-heading">{content.faqHeading}</h2>
          <NicheFaq items={faqs} />
        </div>
      </section>

      <NicheMark name="final">
        <section className="lx-section" id="final-cta">
          <div className="lx-wrap lx-hero-inner">
            <h2 className="lx-heading">{content.finalCta.heading}</h2>
            <p className="lx-lead">{content.finalCta.text}</p>
            <NicheCta />
          </div>
        </section>
      </NicheMark>

      <NicheMark name="footer">
        <footer className="lx-foot">
          <p>
            © Divine Acquisition. All rights reserved. <a href={LEGAL_TERMS_URL}>Terms</a>
            {' · '}
            <a href={LEGAL_PRIVACY_URL}>Privacy</a>
          </p>
          <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
          <details id="sources" className="niche-sources">
            <summary>{content.sourcesLabel}</summary>
            <ol>
              {content.sources.map((source) => (
                <li key={source.id} id={`source-${source.n}`}>
                  <a href={source.href} target="_blank" rel="noopener noreferrer">
                    {source.listing}
                  </a>
                </li>
              ))}
            </ol>
            <p>{content.sourcesNote}</p>
          </details>
        </footer>
      </NicheMark>
    </NicheExperience>
  );
}
