import { GO_VSL_MEDIA_ID, wistiaAspectRatio } from '@/lib/go/config';
import {
  CALENDAR,
  CTA_LABEL,
  FACEBOOK_DISCLAIMER,
  FAQ,
  FINAL_CTA,
  FIT_HEADLINE,
  FIT_NO,
  FIT_NO_TITLE,
  FIT_YES,
  FIT_YES_TITLE,
  FOUNDING_OFFER,
  HEADLINE_ACCENT,
  HEADLINE_AFTER,
  HEADLINE_BEFORE,
  INCLUDED,
  INCLUDED_FOOTNOTE,
  INCLUDED_TITLE,
  LANDING_TRUST,
  MATH,
  MATH_HEADLINE,
  MATH_LEAD,
  PILL_BANNER,
  PRICING_LINE,
  PROBLEMS,
  PROBLEMS_HEADLINE,
  PROCESS,
  PROCESS_HEADLINE,
  SUBHEADLINE,
  SYSTEMS,
  SYSTEMS_HEADLINE,
  SYSTEMS_LEAD,
  TESTIMONIALS,
  TESTIMONIALS_HEADLINE,
  TESTIMONIALS_LEAD,
  VIDEO_LABEL,
} from '@/lib/go/copy';
import { DemoLink } from './components/DemoLink';
import { StrategyCalendar } from './components/StrategyCalendar';
import { GoWistia } from './components/GoWistia';

function Check() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden>
      <path d="m4 10 4 4 8-8" />
    </svg>
  );
}

function BookLink() {
  return (
    <a className="acq-button" href="#calendar">
      {CTA_LABEL}
    </a>
  );
}

export default function CleaningFunnelPage() {
  return (
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
          <p className="lx-requirement">{PRICING_LINE}</p>
          <p className="lx-requirement">{VIDEO_LABEL}</p>
          <div className="lx-video-wrap">
            <div className="lx-video-shell">
              <GoWistia mediaId={GO_VSL_MEDIA_ID} />
            </div>
          </div>
          <DemoLink />
          <BookLink />
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

      <section className="lx-section" id="results">
        <div className="lx-wrap">
          <h2 className="lx-heading">{TESTIMONIALS_HEADLINE}</h2>
          <p className="lx-intro">{TESTIMONIALS_LEAD}</p>
          <ul className="go-results">
            {TESTIMONIALS.map((item) => (
              <li key={item.name} className="lx-card">
                <p className="go-kicker">{item.videoId ? 'Live testimonial' : 'Interview coming soon'}</p>
                <div className="go-person">
                  <span className="go-initials">{item.initials}</span>
                  <div>
                    <p className="go-name">{item.name}</p>
                    <p className="go-role">{item.role}</p>
                  </div>
                </div>
                {item.videoId ? (
                  <GoWistia mediaId={item.videoId} aspect={wistiaAspectRatio(item.videoAspect)} />
                ) : (
                  <div className="go-placeholder">
                    <p>Nathan&apos;s interview is being recorded.</p>
                  </div>
                )}
                <blockquote className="go-quote">&ldquo;{item.quote}&rdquo;</blockquote>
                <ul className="go-stats">
                  {item.stats.map((stat) => (
                    <li key={stat.label}>
                      <strong>{stat.value}</strong>
                      <span>{stat.label}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lx-section" id="product">
        <div className="lx-wrap">
          <h2 className="lx-heading">{INCLUDED_TITLE}</h2>
          <ul className="lx-offer">
            {INCLUDED.map((item) => (
              <li key={item.title} className="lx-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="lx-callout">{INCLUDED_FOOTNOTE}</p>
          <div className="lx-center">
            <BookLink />
          </div>
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap">
          <h2 className="lx-heading">{PROBLEMS_HEADLINE}</h2>
          <ul className="lx-patterns">
            {PROBLEMS.map((problem, index) => (
              <li key={problem.title} className="lx-card lx-pattern">
                <span className="lx-num">{String(index + 1).padStart(2, '0')}</span>
                <h3>{problem.title}</h3>
                <p>{problem.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap">
          <h2 className="lx-heading">{SYSTEMS_HEADLINE}</h2>
          <p className="lx-intro">{SYSTEMS_LEAD}</p>
          <ol className="lx-steps">
            {SYSTEMS.map((system, index) => (
              <li key={system.key} className="lx-card">
                <span className="lx-num lx-num-brand">{String(index + 1).padStart(2, '0')}</span>
                <h3>{system.title}</h3>
                <p>{system.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap">
          <h2 className="lx-heading">{PROCESS_HEADLINE}</h2>
          <ol className="lx-steps">
            {PROCESS.map((step, index) => (
              <li key={step.title} className="lx-card">
                <span className="lx-num lx-num-brand">{String(index + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
          <div className="lx-center">
            <BookLink />
          </div>
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap">
          <h2 className="lx-heading">{MATH_HEADLINE}</h2>
          <p className="lx-intro">{MATH_LEAD}</p>
          <ul className="lx-steps">
            {MATH.map((item) => (
              <li key={item.title} className="lx-card">
                <h3>{item.title}</h3>
                <p className="go-delta">
                  {item.from} → <span>{item.to}</span>
                </p>
                <p>{item.caption}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap">
          <h2 className="lx-heading">{FIT_HEADLINE}</h2>
          <ul className="lx-audience">
            <li className="lx-card lx-featured">
              <h3>{FIT_YES_TITLE}</h3>
              <ul>
                {FIT_YES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
            <li className="lx-card">
              <h3>{FIT_NO_TITLE}</h3>
              <ul>
                {FIT_NO.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          </ul>
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap lx-hero-inner">
          <h2 className="lx-heading">{FOUNDING_OFFER.eyebrow}</h2>
          <p className="lx-callout">
            <strong>{FOUNDING_OFFER.lead}</strong> {FOUNDING_OFFER.body}
          </p>
          <BookLink />
        </div>
      </section>

      <section className="lx-section" id="faq">
        <div className="lx-wrap">
          <h2 className="lx-heading">{FAQ.headline}</h2>
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
        </div>
      </section>

      <section className="lx-section" id="calendar">
        <div className="lx-wrap">
          <div className="lx-hero-inner">
            <h2 className="lx-heading">
              {CALENDAR.titleBefore}
              <span className="lx-accent">{CALENDAR.titleAccent}</span>
              {CALENDAR.titleAfter}
            </h2>
            <p className="lx-lead">{CALENDAR.body}</p>
          </div>
          <StrategyCalendar />
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap lx-hero-inner">
          <h2 className="lx-heading">{FINAL_CTA.headline}</h2>
          <p className="lx-lead">{FINAL_CTA.body}</p>
          <p className="lx-requirement">{FINAL_CTA.caption}</p>
          <BookLink />
        </div>
      </section>

      <footer className="lx-foot">
        <ul className="go-foot-links">
          <li>
            <a href="#results">Results</a>
          </li>
          <li>
            <a href="#product">What&apos;s included</a>
          </li>
          <li>
            <a href="#faq">FAQ</a>
          </li>
          <li>
            <a href="#calendar">Book a session</a>
          </li>
        </ul>
        <p>
          <a href="mailto:hello@divineacquisition.io">hello@divineacquisition.io</a>
        </p>
        <p>© {new Date().getFullYear()} Divine Acquisition. All rights reserved.</p>
        <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
