import { MagicCard } from '@/components/ui/magic-card';
import { ShineBorder } from '@/components/ui/shine-border';
import { FACEBOOK_DISCLAIMER, LEGAL_DISCLAIMER_URL, LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import {
  frontOfficeFaqs,
  frontOfficePriceFoot,
  leakCatalog,
  type FrontOfficeContent,
} from '@/lib/acq/front-office-content';
import type { HeadlineVariant, NicheVisit } from '@/lib/acq/niche-tracking';
import { EMAIL_FOOTER } from '@/lib/booking-messages/copy';
import { LeakCalculator } from './LeakCalculator';
import { NicheFaq } from './NicheFaq';
import { NicheCta, NicheExperience, NicheMark } from './NicheExperience';

function Terms({ terms }: { terms: string[] }) {
  return (
    <ul className="niche-chips">
      {terms.map((term) => (
        <li key={term}>{term}</li>
      ))}
    </ul>
  );
}

export function FrontOfficeFooter() {
  return (
    <footer className="lx-foot">
      <p>{EMAIL_FOOTER}</p>
      <p>
        <a href={LEGAL_TERMS_URL}>Terms</a>
        {' · '}
        <a href={LEGAL_PRIVACY_URL}>Privacy</a>
        {' · '}
        <a href={LEGAL_DISCLAIMER_URL}>Disclaimer</a>
      </p>
      <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
    </footer>
  );
}

export function FrontOfficeLanding({
  content,
  variant,
  tracking,
  fallback,
}: {
  content: FrontOfficeContent;
  variant: HeadlineVariant;
  tracking: NicheVisit;
  fallback: boolean;
}) {
  const headline = content.headlines[variant];
  const faqs = frontOfficeFaqs(content);
  const priceFoot = frontOfficePriceFoot(content);

  return (
    <NicheExperience
      button={content.button}
      form={content.form}
      variant={variant}
      tracking={tracking}
      className="acq-niche-ai"
      application={{ ...content.form, leaksByBusiness: leakCatalog() }}
    >
      <section
        className="lx-hero"
        data-offer="ai-front-office"
        data-page={content.id}
        data-fallback={fallback ? 'shared' : 'niche'}
        data-price={content.showPrice ? 'on' : 'off'}
      >
        <div className="lx-wrap lx-hero-inner">
          <p className="lx-pill">{content.pill}</p>
          <h1 className="lx-headline" data-headline={variant}>
            {headline.before}
            {headline.highlight ? <em className="acq-headline-accent">{headline.highlight}</em> : null}
            {headline.after}
          </h1>
          <p className="lx-lead">{content.subhead}</p>
          <p className="niche-quiet">{content.qualifier}</p>
          <NicheCta mark="hero" />
          <Terms terms={content.terms} />
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <h2 className="lx-heading">{content.leakHeading}</h2>
          <ul className="niche-places">
            {content.leaks.map((card) => (
              <li key={card.title}>
                <MagicCard className="h-full rounded-3xl" contentClassName="lx-card h-full">
                  <p className="niche-example">{content.exampleLabel}</p>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </MagicCard>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <h2 className="lx-heading">{content.calculator.heading}</h2>
          <LeakCalculator calculator={content.calculator} />
          <p className="niche-foot-line">{content.calculator.foot}</p>
        </div>
      </section>

      <section className="lx-section niche-reveal" data-price-foot={priceFoot ? 'on' : 'off'}>
        <div className="lx-wrap">
          <h2 className="lx-heading">{content.buildHeading}</h2>
          <ul className="niche-needs">
            {content.buildItems.map((item) => (
              <li key={item.title} className="lx-card">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
          <p className="niche-foot-line">{content.buildFoot}</p>
          {priceFoot ? <p className="niche-foot-line niche-price-line">{priceFoot}</p> : null}
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <h2 className="lx-heading">{content.stepsHeading}</h2>
          <ol className="niche-steps-list">
            {content.steps.map((step, index) => (
              <li key={step.title} className="lx-card">
                <span className="niche-step-num">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <article className="lx-card lx-featured niche-proof">
            <p className="niche-kicker">{content.proof.label}</p>
            <p>{content.proof.text}</p>
            {content.proof.honesty ? <p className="niche-honesty">{content.proof.honesty}</p> : null}
          </article>
          {content.proof.clientResult.enabled ? (
            <article className="lx-card niche-proof">
              <p className="niche-kicker">{content.proof.clientResult.label}</p>
              <p>{content.proof.clientResult.text}</p>
              {content.proof.clientResult.honesty ? (
                <p className="niche-honesty">{content.proof.clientResult.honesty}</p>
              ) : null}
            </article>
          ) : null}
        </div>
      </section>

      <section className="lx-section niche-reveal">
        <div className="lx-wrap">
          <h2 className="lx-heading">{content.fitHeading}</h2>
          <ul className="niche-chips niche-industry-chips">
            {content.industries.map((industry) => (
              <li key={industry.id}>
                <a href={industry.href} aria-current={industry.id === content.id ? 'page' : undefined}>
                  {industry.label}
                </a>
              </li>
            ))}
          </ul>
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
          <h2 className="lx-heading">{content.faqHeading}</h2>
          <NicheFaq items={faqs} />
        </div>
      </section>

      <NicheMark name="final">
        <section className="lx-section" id="final-cta">
          <div className="lx-wrap lx-hero-inner">
            <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[28px] px-6 py-10">
              <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} borderWidth={1} />
              <h2 className="lx-headline">{content.finalCta.heading}</h2>
              <p className="lx-lead">{content.finalCta.text}</p>
              <NicheCta mark="final" />
              <Terms terms={content.terms} />
            </div>
          </div>
        </section>
      </NicheMark>

      <NicheMark name="footer">
        <FrontOfficeFooter />
      </NicheMark>
    </NicheExperience>
  );
}
