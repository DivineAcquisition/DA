import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { BorderBeam } from '@/components/ui/border-beam';
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
import {
  Bot,
  CalendarCheck,
  CircleCheck,
  ClipboardCheck,
  Clock3,
  Inbox,
  LineChart,
  type LucideIcon,
  MessageCircle,
  MessagesSquare,
  Phone,
  Target,
  UserRoundCheck,
  Wrench,
  X,
} from 'lucide-react';
import HeroVideo from './components/HeroVideo';
import { QualifyButton, QualifyProvider } from './components/QualifyGate';

const BUILD_ICONS = [Inbox, Target, MessagesSquare, Bot, Phone, LineChart] as const;
const QUESTION_ICONS = [Clock3, UserRoundCheck, MessageCircle] as const;
const STEP_ICONS = [ClipboardCheck, Wrench, CalendarCheck] as const;

function SaasIcon({ icon: Icon, tone = 'brand' }: { icon: LucideIcon; tone?: 'brand' | 'red' }) {
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

  return (
    <QualifyProvider tracking={tracking}>
      <div className="acq-coaches min-h-screen antialiased">
        <section className="lx-hero">
          <div className="lx-wrap lx-hero-inner">
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
          </div>
        </section>

        <section className="lx-section">
          <div className="lx-wrap">
            <h2 className="lx-heading">{BUILD.eyebrow}</h2>
            <p className="lx-intro">{BUILD.note}</p>
            <ul className="lx-offer">
              {BUILD.items.map((item, index) => (
                <li key={item.title} className="lx-card">
                  <div className="lx-card-title">
                    <SaasIcon icon={BUILD_ICONS[index] ?? Inbox} />
                    <h3>{item.title}</h3>
                  </div>
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
                  <div className="lx-card-title">
                    <SaasIcon icon={QUESTION_ICONS[index] ?? Clock3} />
                    <span className="lx-num">{String(index + 1).padStart(2, '0')}</span>
                  </div>
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
              {HOW_IT_WORKS.steps.map((step, index) => (
                <li key={step.label} className="lx-card">
                  <div className="lx-card-title">
                    <SaasIcon icon={STEP_ICONS[index] ?? ClipboardCheck} />
                    <span className="lx-num lx-num-brand">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
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
                  <SaasIcon icon={CircleCheck} />
                  <h3>A fit</h3>
                </div>
                <p>{AUDIENCE.fit}</p>
              </li>
              <li className="lx-card lx-not-fit">
                <div className="lx-card-title">
                  <SaasIcon icon={X} tone="red" />
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
