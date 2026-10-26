'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import Logo from '@/app/components/Logo';
import { Badge, StatGrid, StatTile } from '@/app/vistrial/components/ui';
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Panel } from '@/components/ui/panel';
import { REVENUE_LEAK, REVENUE_LEAK_TESTIMONIALS } from '@/lib/acq/revenue-leak-content';
import { captureVisitAttribution, type NicheVisit } from '@/lib/acq/niche-tracking';
import { cn } from '@/lib/utils';
import { trackPixelCustom } from '../MetaPixel';
import { BookingEmbed } from './BookingEmbed';
import { GapPipeline } from './GapPipeline';
import { LeakFooter } from './LeakChrome';
import { VslPlayer } from './VslPlayer';

const page = REVENUE_LEAK;

function trackBooking(placement: string) {
  trackPixelCustom('BookingClick', { placement, content_name: 'Revenue Leak Audit' });
}

function AuditLink({
  placement,
  className,
  style,
  children,
}: {
  placement: string;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}) {
  return (
    <a
      href="#book"
      className={cn(
        'acq-button no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300',
        className,
      )}
      style={style}
      onClick={() => trackBooking(placement)}
    >
      {children ?? page.cta}
    </a>
  );
}

function SectionLabel({ children, tone = 'brand' }: { children: string; tone?: 'brand' | 'critical' }) {
  return (
    <Badge tone={tone} className="px-3 py-1 text-[11px] uppercase tracking-[0.16em]">
      {children}
    </Badge>
  );
}

function Section({
  id,
  label,
  title,
  tone = 'brand',
  children,
}: {
  id?: string;
  label?: string;
  title: string;
  tone?: 'brand' | 'critical';
  children: ReactNode;
}) {
  const problem = tone === 'critical';
  return (
    <section
      id={id}
      className={cn('scroll-mt-20', problem && 'border-y border-flag-critical/25 bg-flag-critical/[0.05]')}
    >
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        {label ? <SectionLabel tone={tone}>{label}</SectionLabel> : null}
        <h2
          className={cn(
            'acq-headline max-w-3xl text-[1.65rem] font-extrabold leading-[1.12] tracking-tight text-white normal-case sm:text-4xl',
            label && 'mt-3',
          )}
        >
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

export function LeakLanding({ tracking }: { tracking: NicheVisit }) {
  const [pastHero, setPastHero] = useState(false);
  const [hideSticky, setHideSticky] = useState(false);

  useEffect(() => {
    captureVisitAttribution(tracking);
  }, [tracking]);

  useEffect(() => {
    const seen = new Set<number>();
    let frame = 0;
    const measure = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const ratio = window.scrollY / max;
      for (const mark of [25, 50, 75, 100]) {
        if (seen.has(mark)) continue;
        const threshold = mark === 100 ? 0.98 : mark / 100;
        if (ratio < threshold) continue;
        seen.add(mark);
        trackPixelCustom('ScrollDepth', { depth: mark, content_name: 'Revenue Leak Audit' });
      }
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const hero = document.getElementById('hero');
    const book = document.getElementById('book');
    if (!hero || !book) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target.id === 'hero') {
          setPastHero(entry.boundingClientRect.bottom < 72);
        }
        if (entry.target.id === 'book') {
          setHideSticky(entry.boundingClientRect.top < window.innerHeight * 0.82);
        }
      }
    });
    observer.observe(hero);
    observer.observe(book);
    return () => observer.disconnect();
  }, []);

  const showSticky = pastHero && !hideSticky;

  return (
    <div className={cn('min-h-screen bg-ink-950 text-white antialiased', showSticky && 'pb-24 md:pb-0')}>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo className="h-5 w-auto" title={page.brand} />
          <AuditLink
            placement="header"
            className="acq-button-full"
            style={{ width: 'auto', minHeight: '2.75rem', padding: '0.55rem 0.9rem', fontSize: '0.8125rem' }}
          />
        </div>
      </header>

      <main>
        <section id="hero" className="px-4 pb-14 pt-8 sm:px-6 sm:pt-12">
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            <SectionLabel>{page.hero.label}</SectionLabel>
            <h1 className="acq-headline mt-4 max-w-3xl text-[1.85rem] font-extrabold leading-[1.08] tracking-tight text-white normal-case sm:text-5xl">
              {page.hero.headline}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-300 sm:text-lg">{page.hero.subhead}</p>
            <VslPlayer />
            <AuditLink placement="hero" className="acq-button-full mt-5 max-w-xl" />
            <p className="mt-3 text-sm text-neutral-400">{page.hero.note}</p>
            <div className="leak-stats mt-8 w-full text-left">
              <style>{`
                .leak-stats dl { grid-template-columns: 1fr; }
                @media (min-width: 640px) {
                  .leak-stats dl { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                }
                .leak-stats dl > div { display: flex; flex-direction: column; }
                .leak-stats dl > div > p:first-child {
                  order: 2;
                  margin-top: 0.5rem;
                  font-size: 0.8125rem;
                  font-weight: 500;
                  letter-spacing: 0;
                  text-transform: none;
                  line-height: 1.4;
                  color: #d4d4d4;
                }
                .leak-stats dl > div > p:nth-child(2) {
                  order: 1;
                  margin-top: 0;
                  font-size: 1.875rem;
                  line-height: 1.1;
                }
              `}</style>
              <StatGrid columns={3}>
                {page.hero.stats.map((stat) => (
                  <StatTile key={stat.value} tone="critical" value={stat.value} label={stat.label} />
                ))}
              </StatGrid>
            </div>
            <p className="mt-3 w-full text-left text-xs leading-relaxed text-neutral-500">
              <a className="underline-offset-2 hover:underline" href="#sources">
                {page.hero.sourceLine}
              </a>
            </p>
          </div>
        </section>

        <Section id="problem" label={page.problem.label} title={page.problem.headline} tone="critical">
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-neutral-300">{page.problem.body}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {page.problem.points.map((point) => (
              <li key={point.title}>
                <Panel className="h-full border-flag-critical/25 p-4">
                  <AlertTriangle className="size-4 text-flag-critical" aria-hidden />
                  <h3 className="acq-headline mt-3 text-base font-semibold normal-case text-white">{point.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-300">{point.body}</p>
                </Panel>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-flag-critical/30 bg-flag-critical/[0.08] p-4" role="note">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-flag-critical" aria-hidden />
            <p className="text-sm leading-relaxed text-flag-critical">{page.problem.callout}</p>
          </div>
        </Section>

        <Section id="system" label={page.pipeline.label} title={page.pipeline.headline}>
          <div className="mt-8">
            <GapPipeline
              onOpen={(id) => trackPixelCustom('PipelineStep', { step: id, content_name: 'Revenue Leak Audit' })}
              onSealAll={() => trackPixelCustom('SealAllGaps', { content_name: 'Revenue Leak Audit' })}
            />
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-neutral-400">{page.pipeline.behind}</p>
        </Section>

        <Section id="compare" label={page.compare.label} title={page.compare.headline}>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <Panel className="h-full border-flag-critical/30 p-5">
              <Badge tone="critical">{page.compare.gadget.label}</Badge>
              <ul className="mt-4 space-y-2.5">
                {page.compare.gadget.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-neutral-200">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-flag-critical" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel className="h-full border-brand-500/35 p-5">
              <Badge tone="brand">{page.compare.system.label}</Badge>
              <ul className="mt-4 space-y-2.5">
                {page.compare.system.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-neutral-200">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </Section>

        <Section id="engines" label={page.engines.label} title={page.engines.headline}>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {page.engines.items.map((engine) => (
              <li key={engine.title}>
                <Panel className="h-full p-5">
                  <h3 className="acq-headline text-lg font-semibold normal-case text-white">{engine.title}</h3>
                  <p className="mt-1 text-sm text-brand-200">{engine.line}</p>
                  <ul className="mt-4 space-y-2">
                    {engine.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm leading-relaxed text-neutral-300">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="packages" label={page.packages.label} title={page.packages.headline}>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {page.packages.items.map((item) => (
              <Panel key={item.name} className="flex h-full flex-col p-5">
                <h3 className="acq-headline text-lg font-semibold normal-case text-white">{item.name}</h3>
                <p className="mt-1 text-sm text-neutral-300">{item.line}</p>
                <ul className="mt-4 space-y-2">
                  {item.includes.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-sm leading-relaxed text-neutral-300">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-brand-200">{item.fit}</p>
                <AuditLink placement={`package-${item.name}`} className="acq-button-full mt-5" />
              </Panel>
            ))}
          </div>
          <p className="mt-6 text-sm text-neutral-400">{page.packages.pricingNote}</p>
          {/* Guarantee line: edit REVENUE_LEAK.packages.guarantee. An empty string hides it. */}
          {page.packages.guarantee ? (
            <p className="mt-3 text-sm font-medium text-brand-200">{page.packages.guarantee}</p>
          ) : null}
        </Section>

        <Section id="audit" label={page.audit.label} title={page.audit.headline}>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {page.audit.steps.map((step, index) => (
              <li key={step.label}>
                <Panel className="h-full p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/12 text-sm font-bold text-brand-200">
                    {index + 1}
                  </span>
                  <h3 className="acq-headline mt-4 text-base font-semibold normal-case text-white">{step.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">{step.body}</p>
                </Panel>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-neutral-300">{page.audit.close}</p>
          <AuditLink placement="audit" className="acq-button-full mt-6 max-w-xl" />
        </Section>

        <Section id="build" title={page.build.headline}>
          <div className="relative mt-8">
            <div aria-hidden className="absolute top-4 right-8 left-8 hidden h-px bg-brand-500/40 lg:block" />
            <ol className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
              {page.build.steps.map((step) => (
                <li key={step.when} className="w-52 shrink-0 snap-start lg:w-auto">
                  <Panel className="h-full p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">{step.when}</p>
                    <p className="acq-headline mt-2 text-sm font-semibold normal-case text-white">{step.label}</p>
                  </Panel>
                </li>
              ))}
            </ol>
          </div>
          <ul className="mt-5 flex flex-wrap gap-2">
            {page.build.badges.map((badge) => (
              <li key={badge}>
                <Badge tone="brand">{badge}</Badge>
              </li>
            ))}
          </ul>
        </Section>

        {REVENUE_LEAK_TESTIMONIALS.length > 0 ? (
          <Section id="results" title={page.results.label}>
            <div className="mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
              {REVENUE_LEAK_TESTIMONIALS.map((item) => (
                <Panel key={`${item.name}-${item.business}`} className="w-[85%] shrink-0 snap-start p-5 md:w-auto">
                  {item.result ? <p className="text-sm font-semibold text-brand-200">{item.result}</p> : null}
                  <blockquote className={`text-sm leading-relaxed text-neutral-200 ${item.result ? 'mt-3' : ''}`}>
                    &ldquo;{item.quote}&rdquo;
                  </blockquote>
                  <footer className="mt-4 flex items-center gap-3">
                    {item.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.photo}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        className="size-10 rounded-full object-cover"
                      />
                    ) : null}
                    <div>
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                      <p className="text-xs text-neutral-400">{item.business}</p>
                    </div>
                  </footer>
                </Panel>
              ))}
            </div>
          </Section>
        ) : null}

        <Section id="faq" title={page.faq.label}>
          <Accordion multiple className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] px-4 sm:px-5">
            {page.faq.items.map((item) => (
              <AccordionItem key={item.question} value={item.question} className="border-white/10">
                <AccordionTrigger className="acq-headline min-h-12 py-4 text-base font-semibold normal-case text-white hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionPanel className="text-sm leading-relaxed text-neutral-400">{item.answer}</AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>

        <Section id="book" label={page.booking.label} title={page.booking.headline}>
          <div className="mt-8">
            <BookingEmbed tracking={tracking} />
          </div>
          <p className="mt-4 text-sm text-neutral-300">{page.booking.reassurance}</p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-neutral-500">{page.booking.consent}</p>
        </Section>
      </main>

      <LeakFooter sources />

      {showSticky ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          <AuditLink placement="sticky" className="acq-button-full" />
        </div>
      ) : null}
    </div>
  );
}
