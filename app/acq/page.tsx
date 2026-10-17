import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from '@/components/ui/accordion';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { BlurFade } from '@/components/ui/blur-fade';
import { BorderBeam } from '@/components/ui/border-beam';
import { DotPattern } from '@/components/ui/dot-pattern';
import { NumberTicker } from '@/components/ui/number-ticker';
import { ShineBorder } from '@/components/ui/shine-border';
import { trackingFromSearchParams, type SearchParams } from '@/lib/acq/config';
import {
  AUDIENCE,
  BUILD,
  CLOSING,
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
  QUESTIONS,
  SUBHEADLINE,
  WHY_US,
} from '@/lib/acq/copy';
import { CircleCheck, X } from 'lucide-react';
import HeroVideo from './components/HeroVideo';
import { OfferScene } from './components/OfferScenes';
import { QualifyButton, QualifyProvider } from './components/QualifyGate';

function Mark({ icon: Icon, tone = 'brand' }: { icon: typeof CircleCheck; tone?: 'brand' | 'red' }) {
  return (
    <span className={tone === 'red' ? 'lx-saas-icon lx-saas-icon-red' : 'lx-saas-icon'}>
      <Icon aria-hidden />
    </span>
  );
}

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
  const testMode = query.da_test === '1' || (Array.isArray(query.da_test) && query.da_test.includes('1'));

  return (
    <QualifyProvider tracking={tracking} testMode={testMode}>
      <div className="acq-coaches min-h-screen antialiased">
        <section className="lx-hero relative overflow-hidden">
          <DotPattern
            className="pointer-events-none absolute inset-0 text-[rgba(154,136,252,0.45)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
            width={22}
            height={22}
            cr={1}
          />
          <div className="lx-wrap lx-hero-inner relative z-[1]">
            <BlurFade delay={0.05} offset={10}>
            <p className="lx-pill">
              <AnimatedShinyText className="mx-0 max-w-none text-inherit">{PILL_BANNER}</AnimatedShinyText>
            </p>
            <h1 className="lx-headline">
              {HEADLINE_BEFORE}
              <span className="lx-accent">{HEADLINE_ACCENT}</span>
              {HEADLINE_AFTER}
            </h1>
            <p className="lx-lead">{SUBHEADLINE}</p>
            <p className="lx-qualifier">{LANDING_QUALIFIER}</p>
            <HeroVideo shell />
            <QualifyButton />
            <ul className="lx-trust lx-trust-cols">
              <li>
                <Check />
                <span>
                  $<NumberTicker value={6500} className="text-[var(--lx-accent-soft)]" /> for 3 months
                </span>
              </li>
              <li>
                <Check />
                {LANDING_TRUST[1]}
              </li>
              <li>
                <Check />
                <span>
                  <NumberTicker value={75} className="text-[var(--lx-accent-soft)]" />% back if we miss your
                  targets
                </span>
              </li>
            </ul>
            </BlurFade>
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap">
            <h2 className="lx-heading">{BUILD.eyebrow}</h2>
            <p className="lx-intro">{BUILD.note}</p>
            <ul className="lx-offer">
              {BUILD.items.map((item) => (
                <li key={item.title} className="lx-card">
                  <OfferScene title={item.title} />
                  <h3>{item.title}</h3>
                  <ul>
                    {item.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <p className="lx-done">
                    <strong>Done when:</strong> {item.done}
                  </p>
                </li>
              ))}
            </ul>
            <p className="lx-callout">
              <strong>The audit is free.</strong> You keep the findings either way.
            </p>
            <div className="lx-center">
              <QualifyButton />
            </div>
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap">
            <h2 className="lx-heading">{WHY_US.eyebrow}</h2>
            <p className="lx-intro">{PROBLEM.body}</p>
            <ul className="lx-patterns">
              {QUESTIONS.items.map((question, index) => (
                <li key={question} className="lx-card lx-pattern">
                  <span className="lx-num">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{question}</h3>
                </li>
              ))}
            </ul>
            <div className="lx-close">
              <p>{WHY_US.lead}</p>
              <h3>So you see the leak before you pay.</h3>
              <ul>
                {WHY_US.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="lx-center">
              <QualifyButton />
            </div>
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap">
            <h2 className="lx-heading">{HOW_IT_WORKS.eyebrow}</h2>
            <ol className="lx-steps">
              {HOW_IT_WORKS.steps.map((step) => (
                <li key={step.label} className="lx-card relative overflow-hidden">
                  <BorderBeam size={70} duration={12} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} />
                  <OfferScene title={step.label} />
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
              <li className="lx-card lx-featured lx-magic">
                <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} borderWidth={1} duration={14} />
                <BorderBeam size={80} duration={10} colorFrom="#9A88FC" colorTo="#C3B6FE" borderWidth={1} />
                <div className="lx-card-title">
                  <Mark icon={CircleCheck} />
                  <h3>A fit</h3>
                </div>
                <p>{AUDIENCE.fit}</p>
              </li>
              <li className="lx-card lx-not-fit">
                <div className="lx-card-title">
                  <Mark icon={X} tone="red" />
                  <h3>Not a fit</h3>
                </div>
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
            <Accordion className="lx-faq">
              {FAQ.items.map((item) => (
                <AccordionItem key={item.question} value={item.question} className="lx-card overflow-hidden border-0">
                  <AccordionTrigger className="px-4 text-base font-semibold normal-case tracking-normal text-[var(--lx-accent-soft)]">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionPanel className="px-4 text-base leading-relaxed text-[var(--lx-muted)]">
                    {item.answer}
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="lx-center">
              <QualifyButton />
            </div>
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap lx-hero-inner">
            <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[28px] px-6 py-10">
              <ShineBorder shineColor={['#9A88FC', '#C3B6FE']} borderWidth={1} />
              <h2 className="lx-heading">{CLOSING.title}</h2>
              <p className="lx-lead">{CLOSING.note}</p>
              <QualifyButton />
            </div>
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
