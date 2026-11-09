import Image from 'next/image';

import { BlurFade } from '@/components/ui/blur-fade';
import { Marquee } from '@/components/ui/marquee';
import {
  APPROACH,
  ABOUT,
  DIAGNOSTIC_PATH,
  FOUNDER_PATH,
  PHILOSOPHY_PATH,
  SALES_OPS_PATH,
  FOUNDER,
  HERO,
  PROBLEM,
  SALES_OPS,
  SITE,
  SOCIALS,
  TOOL_STRIP,
  WHO,
  WORK,
} from '@/lib/site/content';

import { ArrowLink, ButtonLink, Eyebrow, Section, SectionHeading, shell, ToolLogo } from './components/primitives';
import { SiteNav } from './components/site-nav';
import { SystemMap } from './components/system-map';
import { ApproachRun, FitCheck, HandoffTrace } from './components/visuals';
import { FinalCta, SiteFooter } from './components/sections';

/* ------------------------------------------------------------------------ */
/* 01 · Hero                                                                 */
/* ------------------------------------------------------------------------ */

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="da-grid absolute inset-0" />
        <div className="da-glow-hero absolute inset-x-0 top-0 h-[1100px]" />
        <div className="da-spotlight absolute inset-x-0 top-0 h-[700px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0b0a11]" />
      </div>

      <div className={`${shell} relative`}>
        <BlurFade offset={10} blur="6px" duration={0.7} className="mx-auto flex max-w-4xl flex-col items-center text-center">
          {/* The banner: a gradient-edged badge in the original purple, a glowing
              status dot, and a slow sheen. */}
          <p className="da-banner relative inline-flex items-center rounded-full p-px">
            <span className="relative inline-flex items-center gap-3 rounded-full bg-[#110d1d] py-2 pr-5 pl-4">
              <span aria-hidden className="relative flex size-2.5">
                <span className="da-pulse-dot absolute inset-0 rounded-full bg-[#7446ff]" />
                <span className="relative size-2.5 rounded-full bg-gradient-to-b from-[#a78bff] to-[#5a23fc] shadow-[0_0_12px_2px_rgba(90,35,252,0.85)]" />
              </span>
              <span className="da-display text-[13px] font-semibold tracking-[0.01em] text-white sm:text-sm">{HERO.eyebrow}</span>
            </span>
          </p>
          <h1 className="da-display da-gradient-text mt-7 text-[2.5rem] leading-[1.03] font-semibold text-balance sm:text-6xl lg:text-[4.6rem]">
            {HERO.headline}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl">{HERO.lead}</p>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">{HERO.body}</p>
          <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href={DIAGNOSTIC_PATH}>{HERO.primaryCta}</ButtonLink>
            <ButtonLink href="#services" variant="ghost">
              {HERO.secondaryCta}
            </ButtonLink>
          </div>
        </BlurFade>

        <BlurFade delay={0.25} offset={24} blur="8px" duration={0.8} className="mt-16 sm:mt-20">
          <SystemMap />
        </BlurFade>
      </div>
    </section>
  );
}

function ToolStrip() {
  return (
    <section aria-label="Platforms we build with" className="relative border-y border-[#9a88fc]/15 bg-[#0e0c15] py-8">
      <p className="da-mono mb-5 text-center text-[10px] tracking-[0.2em] text-white/40 uppercase">
        Systems designed around the platforms service businesses already run on
      </p>
      <div className="relative [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <Marquee pauseOnHover repeat={3} className="[--duration:55s] [--gap:2.75rem]">
          {TOOL_STRIP.map((tool) => (
            <span key={tool.id} className="flex items-center gap-3 rounded-full border border-[#9a88fc]/15 bg-[#16131f] py-1.5 pr-4 pl-1.5 transition-colors duration-300 hover:border-[#9a88fc]/30 hover:bg-[#211c30]">
              <ToolLogo tool={tool} size={18} className="rounded-full" />
              <span className="text-sm font-medium whitespace-nowrap text-white/75">{tool.name}</span>
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* 02 · The problem                                                          */
/* ------------------------------------------------------------------------ */

function Problem() {
  return (
    <Section id={PROBLEM.id}>
      <SectionHeading index={PROBLEM.index} eyebrow={PROBLEM.eyebrow} headline={PROBLEM.headline} />
      <div className="mt-14 grid items-start gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div className="space-y-8">
          <ol className="space-y-3">
            {PROBLEM.sequence.map((line, index) => (
              <li key={line} className="flex items-baseline gap-4">
                <span className="da-mono text-xs text-[#9a88fc]">0{index + 1}</span>
                <span className="da-display text-xl font-medium tracking-tight text-white sm:text-2xl">{line}</span>
              </li>
            ))}
          </ol>
          <div className="space-y-4 border-l border-[#9a88fc]/20 pl-5 text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">
            <p className="text-white/85">{PROBLEM.handoff}</p>
            <p className="text-white">{PROBLEM.risk}</p>
            <p>{PROBLEM.symptoms}</p>
            <p>{PROBLEM.notMore}</p>
            <p className="text-white/85">{PROBLEM.rebuild}</p>
          </div>
          <p className="da-display text-lg font-medium text-[#c3b6fe]">{PROBLEM.close}</p>
        </div>
        <HandoffTrace />
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------------ */
/* 03 · Core offer (condensed; the full offer is /sales-operations)          */
/* ------------------------------------------------------------------------ */

function ServicesTeaser() {
  return (
    <Section id={SALES_OPS.id}>
      <div className="da-panel-violet relative overflow-hidden rounded-[28px] p-6 sm:p-10 lg:p-12">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <Eyebrow index={SALES_OPS.index}>{SALES_OPS.eyebrow}</Eyebrow>
            <h2 className="da-display da-gradient-text-soft mt-5 text-[2rem] leading-[1.06] font-semibold text-balance sm:text-5xl">{SALES_OPS.name}</h2>
            <p className="da-display mt-4 text-xl font-medium text-[#c3b6fe] sm:text-2xl">{SALES_OPS.positioning}</p>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">{SALES_OPS.positioningBody}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={SALES_OPS_PATH}>See the full offer</ButtonLink>
              <ButtonLink href={DIAGNOSTIC_PATH} variant="ghost">
                {SALES_OPS.cta}
              </ButtonLink>
            </div>
          </div>
          <ol className="grid gap-2.5 sm:grid-cols-2">
            {SALES_OPS.builds.map((build) => (
              <li key={build.name} className="rounded-2xl border border-[#9a88fc]/15 bg-[#16131f] p-4">
                <span className="da-mono text-xs text-[#9a88fc]">{build.index}</span>
                <p className="da-display mt-2 text-base font-semibold tracking-tight text-white">{build.name}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------------ */
/* 04 · Approach                                                             */
/* ------------------------------------------------------------------------ */

function Approach() {
  return (
    <Section id={APPROACH.id}>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <SectionHeading index={APPROACH.index} eyebrow={APPROACH.eyebrow} headline={APPROACH.headline} />
        <div className="space-y-3 text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">
          <p className="text-white/90">{APPROACH.lead}</p>
          <p>{APPROACH.body}</p>
        </div>
      </div>
      <div className="mt-14">
        <ApproachRun />
      </div>
      <div className="mt-10 flex justify-center">
        <ButtonLink href={DIAGNOSTIC_PATH} variant="ghost">
          {APPROACH.cta}
        </ButtonLink>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------------ */
/* 05 · Client work                                                          */
/* ------------------------------------------------------------------------ */

function EngagementFile({ number }: { number: number }) {
  return (
    <div className="da-panel relative overflow-hidden rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="da-mono text-[10px] tracking-[0.18em] whitespace-nowrap text-white/40 uppercase">File {String(number).padStart(3, '0')}</span>
        <span className="da-mono rounded-full border border-[#9a88fc]/30 px-2 py-0.5 text-[9px] tracking-[0.14em] whitespace-nowrap text-[#c3b6fe] uppercase">
          Pending verification
        </span>
      </div>
      <dl className="mt-5 space-y-3.5">
        {WORK.fields.map((field, index) => (
          <div key={field} className="grid grid-cols-[120px_1fr] items-center gap-3">
            <dt className="text-[12px] text-white/50">{field}</dt>
            <dd aria-label="Not yet published" className="da-skeleton h-2.5 rounded-full" style={{ width: `${[78, 92, 46, 70, 84][(index + number) % 5]}%` }} />
          </div>
        ))}
      </dl>
    </div>
  );
}

function Work() {
  const studies = WORK.caseStudies;
  return (
    <Section id={WORK.id}>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <SectionHeading index={WORK.index} eyebrow={WORK.eyebrow} headline={WORK.headline} />
        <div className="space-y-3 text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">
          <p className="text-white/90">{WORK.lead}</p>
          <p>{WORK.body}</p>
        </div>
      </div>
      {studies.length > 0 ? (
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {studies.map((study) => (
            <article key={study.client} className="da-panel flex flex-col rounded-2xl p-6">
              <p className="da-mono text-[10px] tracking-[0.18em] text-[#9a88fc] uppercase">{study.industry}</p>
              <h3 className="da-display mt-3 text-xl font-semibold text-white">{study.client}</h3>
              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-white/45">Scope</dt>
                  <dd className="text-white/85">{study.scope}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Timeframe</dt>
                  <dd className="text-white/85">{study.timeframe}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Systems involved</dt>
                  <dd className="text-white/85">{study.systems.join(', ')}</dd>
                </div>
                <div>
                  <dt className="text-white/45">Documented outcome</dt>
                  <dd className="text-white">{study.outcome}</dd>
                </div>
              </dl>
              {study.href ? <ArrowLink href={study.href} className="mt-6">Read the engagement</ArrowLink> : null}
            </article>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((number) => (
              <EngagementFile key={number} number={number} />
            ))}
          </div>
          <p className="mt-6 text-sm text-white/45">{WORK.pendingNote}</p>
        </>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------------ */
/* 06 · Philosophy and 07 · Founder (condensed; full pages linked)           */
/* ------------------------------------------------------------------------ */

function PhilosophyTeaser() {
  return (
    <Section id={ABOUT.id}>
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <SectionHeading index={ABOUT.index} eyebrow="Our philosophy" headline={ABOUT.headline} />
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-[17px]">{ABOUT.lead}</p>
          <div className="mt-8">
            <ArrowLink href={PHILOSOPHY_PATH}>Read our philosophy</ArrowLink>
          </div>
        </div>
        <div className="da-panel rounded-2xl p-6 sm:p-8">
          <p className="da-mono text-[10px] tracking-[0.18em] text-[#9a88fc] uppercase">{ABOUT.centralLabel}</p>
          <p className="da-display da-gradient-text mt-3 text-2xl leading-tight font-semibold tracking-tight sm:text-[1.7rem]">
            {ABOUT.central.top}
            <br />
            {ABOUT.central.bottom}
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {ABOUT.principles.map((principle) => (
              <li key={principle.name} className="inline-flex items-center gap-2 rounded-full border border-[#9a88fc]/20 bg-[#16131f] px-3 py-1.5 text-sm text-white/85">
                <span className="font-serif text-[#9a88fc]/80 italic">{principle.numeral}</span>
                {principle.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function FounderTeaser() {
  const [opening] = FOUNDER.paragraphs;
  const closing = FOUNDER.paragraphs[FOUNDER.paragraphs.length - 1];
  return (
    <Section id={FOUNDER.id}>
      <div className="da-panel-violet relative overflow-hidden rounded-[28px] p-6 sm:p-10 lg:p-12">
        <div className="grid items-center gap-8 md:grid-cols-[220px_1fr] md:gap-12">
          <div className="relative mx-auto w-full max-w-[220px]">
            <div aria-hidden className="absolute -inset-3 rounded-[26px] bg-[#9a88fc]/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[22px] border border-[#9a88fc]/30 bg-[#0f0d17] p-1.5">
              <Image
                src={FOUNDER.photo.src}
                width={FOUNDER.photo.width}
                height={FOUNDER.photo.height}
                alt={FOUNDER.photo.alt}
                sizes="220px"
                className="h-auto w-full rounded-[17px]"
              />
            </div>
          </div>
          <div>
            <Eyebrow index={FOUNDER.index}>{FOUNDER.eyebrow}</Eyebrow>
            <h2 className="da-display da-gradient-text-soft mt-5 text-[1.8rem] leading-[1.1] font-semibold text-balance sm:text-[2.3rem]">{FOUNDER.headline}</h2>
            <p className="da-display mt-5 text-lg leading-snug font-medium text-white sm:text-xl">{opening}</p>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/65 sm:text-base">{closing}</p>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[#9a88fc]/20 pt-5">
              <div>
                <p className="da-display font-semibold text-white">{FOUNDER.name}</p>
                <p className="text-sm text-white/50">{FOUNDER.title}</p>
              </div>
              <ArrowLink href={FOUNDER_PATH}>Read the full letter</ArrowLink>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------------ */
/* 09 · Who we serve                                                         */
/* ------------------------------------------------------------------------ */

function WhoWeServe() {
  return (
    <Section id={WHO.id}>
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div>
          <SectionHeading index={WHO.index} eyebrow={WHO.eyebrow} headline={WHO.headline} lead={WHO.lead} />
          <p className="mt-8 max-w-lg border-l border-[#9a88fc]/40 pl-5 text-[15px] leading-relaxed text-white/75 sm:text-base">{WHO.close}</p>
        </div>
        <FitCheck />
      </div>
    </Section>
  );
}

export default function DivineAcquisitionHome() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: SITE.legalName,
    url: `${SITE.origin}/`,
    description: SITE.description,
    founder: { '@type': 'Person', name: FOUNDER.name },
    sameAs: SOCIALS.map((social) => social.href),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
      <SiteNav />
      <main>
        <Hero />
        <ToolStrip />
        <Problem />
        <ServicesTeaser />
        <Approach />
        <Work />
        <PhilosophyTeaser />
        <FounderTeaser />
        <WhoWeServe />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
