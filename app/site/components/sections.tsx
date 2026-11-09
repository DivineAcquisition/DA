import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Check, Gauge, Inbox, RefreshCcw, Send } from 'lucide-react';

import { BlurFade } from '@/components/ui/blur-fade';
import { BorderBeam } from '@/components/ui/border-beam';
import { MagicCard } from '@/components/ui/magic-card';
import { ABOUT, CAREERS_URL, DIAGNOSTIC_PATH, FINAL, FOUNDER, HERO, NAV, SALES_OPS, SITE, SOCIALS } from '@/lib/site/content';

import { ButtonLink, Eyebrow, Section, SectionHeading, shell, SocialIcon } from './primitives';
import { SiteNav } from './site-nav';
import { JourneyFlow, PipelineBoard } from './visuals';

/*
 * The full homepage sections that also stand as their own pages: the Sales
 * Operations offer, the philosophy (About), and the founder's letter, plus the
 * closing call to action and footer every site page ends with. The homepage
 * shows condensed versions that link here.
 */

/* ------------------------------------------------------------------------ */
/* 03 · Core service: Sales Operations Build Out                             */
/* ------------------------------------------------------------------------ */

const BUILD_ICONS = [
  <Inbox key="intake" className="size-[18px]" aria-hidden />,
  <Send key="follow-up" className="size-[18px]" aria-hidden />,
  <Gauge key="visibility" className="size-[18px]" aria-hidden />,
  <RefreshCcw key="reactivation" className="size-[18px]" aria-hidden />,
];

export function SalesOperationsFull({ standalone = false }: { standalone?: boolean } = {}) {
  return (
    <Section id={SALES_OPS.id} className={standalone ? 'pt-10 sm:pt-14' : undefined}>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <div>
          <Eyebrow index={standalone ? undefined : SALES_OPS.index}>{SALES_OPS.eyebrow}</Eyebrow>
          <h2 className="da-display da-gradient-text-soft mt-5 text-[2rem] leading-[1.06] font-semibold text-balance sm:text-5xl lg:text-[3.4rem]">
            {SALES_OPS.name}
          </h2>
          <p className="da-display mt-4 text-xl font-medium text-[#c3b6fe] sm:text-2xl">{SALES_OPS.positioning}</p>
        </div>
        <p className="text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">{SALES_OPS.positioningBody}</p>
      </div>

      <article id="sales-operations" className="mt-14 scroll-mt-28 rounded-[24px]">
        <MagicCard
          className="rounded-[24px] border border-[#9a88fc]/15 bg-[#15131f] shadow-[0_0_72px_-28px_rgba(154,136,252,0.55)]"
          contentClassName="grid gap-10 p-6 sm:p-8 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:p-10"
          gradientColor="rgba(154, 136, 252, 0.16)"
          gradientFrom="#9a88fc"
          gradientTo="#c3b6fe"
        >
          <BorderBeam duration={12} size={160} colorFrom="#9a88fc" colorTo="#c3b6fe" borderWidth={1} />
          <div>
            <h3 className="da-display text-2xl leading-tight font-semibold tracking-tight text-white sm:text-[2rem]">{SALES_OPS.headline}</h3>
            <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-[#aaa4c4] sm:text-base">
              {SALES_OPS.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="da-display mt-6 text-lg font-medium text-white/90">{SALES_OPS.supporting}</p>
            <div className="mt-7">
              <ButtonLink href={DIAGNOSTIC_PATH}>{SALES_OPS.cta}</ButtonLink>
            </div>
          </div>
          <PipelineBoard />
        </MagicCard>
      </article>

      <p className="da-mono mt-16 text-[10px] tracking-[0.18em] text-white/40 uppercase">What we build</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SALES_OPS.builds.map((build, index) => (
          <li key={build.name} className="rounded-2xl">
            <MagicCard
              className="h-full rounded-2xl border border-[#9a88fc]/15 bg-[#16131f]"
              contentClassName="flex h-full flex-col p-5"
              gradientColor="rgba(154, 136, 252, 0.14)"
              gradientFrom="#9a88fc"
              gradientTo="#c3b6fe"
            >
              <div className="flex items-center justify-between">
                <span className="da-icon-tile flex size-10 items-center justify-center rounded-xl">{BUILD_ICONS[index]}</span>
                <span className="da-mono text-xs text-[#9a88fc]">{build.index}</span>
              </div>
              <h3 className="da-display mt-5 text-lg font-semibold tracking-tight text-white">{build.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{build.body}</p>
            </MagicCard>
          </li>
        ))}
      </ol>

      <div className="mt-16 flex flex-wrap items-end justify-between gap-3">
        <p className="da-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">Who it serves</p>
        <p className="text-sm text-white/50">{SALES_OPS.marketsIntro}</p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {SALES_OPS.markets.map((market) => (
          <article id={market.id} key={market.id} className="da-panel flex scroll-mt-28 flex-col rounded-2xl p-6 sm:p-7">
            <p className="da-mono text-[10px] tracking-[0.16em] text-[#9a88fc] uppercase">{market.label}</p>
            <h3 className="da-display mt-3 text-xl leading-snug font-semibold tracking-tight text-white sm:text-2xl">{market.headline}</h3>
            <div className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-[#aaa4c4]">
              {market.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="da-mono mt-6 mb-2.5 text-[10px] tracking-[0.16em] text-white/40 uppercase">Typical sales journey</p>
            <JourneyFlow stages={market.journey} label={`Typical sales journey: ${market.journey.join(', ')}`} />
            <p className="da-mono mt-6 text-[10px] tracking-[0.16em] text-white/40 uppercase">Common implementation priorities</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {market.priorities.map((priority) => (
                <li key={priority} className="flex items-start gap-2.5 text-sm text-white/80">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[#b59aff]" aria-hidden />
                  {priority}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="da-panel-violet mt-4 grid gap-8 rounded-2xl p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="da-mono text-[10px] tracking-[0.18em] text-[#b59aff] uppercase">{SALES_OPS.scopeTitle}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-white/80">{SALES_OPS.scopeIntro}</p>
          <p className="mt-4 text-xs leading-relaxed text-white/45">{SALES_OPS.scopeNote}</p>
        </div>
        <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {SALES_OPS.scope.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-white/85">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-[#5a23fc]/25">
                <Check className="size-2.5 text-[#d9d0ff]" aria-hidden />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <p className="da-display text-lg font-medium text-white/85">{SALES_OPS.supporting}</p>
        <ButtonLink href={DIAGNOSTIC_PATH}>{SALES_OPS.cta}</ButtonLink>
      </div>
    </Section>
  );
}


/* ------------------------------------------------------------------------ */
/* 06 · About                                                                */
/* ------------------------------------------------------------------------ */

export function PhilosophyFull({ standalone = false }: { standalone?: boolean } = {}) {
  const { image, central, statement } = ABOUT;
  return (
    <section id={ABOUT.id} className={`relative scroll-mt-28 overflow-hidden ${standalone ? 'pt-10 pb-24 sm:pt-14 sm:pb-32' : 'py-24 sm:py-32'}`}>
      <div aria-hidden className="pointer-events-none absolute top-1/4 left-[-10%] h-[520px] w-[520px] rounded-full bg-[#5a23fc]/15 blur-[120px]" />
      <BlurFade inView inViewMargin="-80px" offset={14} blur="4px" duration={0.6} className={shell}>
        <div className="grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <figure className="relative mx-auto w-full max-w-[420px] lg:sticky lg:top-28">
            <Image
              src={image.src}
              width={image.width}
              height={image.height}
              alt={image.alt}
              sizes="(min-width: 1024px) 420px, 80vw"
              className="h-auto w-full select-none [mask-image:linear-gradient(180deg,#000_55%,transparent_100%)]"
            />
            <figcaption className="relative -mt-10">
              <p className="da-mono text-[10px] tracking-[0.18em] text-[#9a88fc] uppercase">{ABOUT.centralLabel}</p>
              <p className="da-display da-gradient-text mt-3 text-2xl leading-tight font-semibold tracking-tight sm:text-[1.7rem]">
                {central.top}
                <br />
                {central.bottom}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-white/55">{image.caption}</p>
              <p className="mt-3 text-[11px] text-white/30">{image.credit}</p>
            </figcaption>
          </figure>

          <div>
            <SectionHeading index={standalone ? undefined : ABOUT.index} eyebrow={standalone ? 'Our philosophy' : ABOUT.eyebrow} headline={ABOUT.headline} />
            <div className="mt-6 max-w-xl space-y-4 text-base leading-relaxed text-[#aaa4c4] sm:text-[17px]">
              <p className="text-white/90">{ABOUT.lead}</p>
              {ABOUT.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <p className="da-display mt-7 max-w-xl border-l-2 border-[#9a88fc]/60 pl-5 text-lg leading-snug font-medium text-white sm:text-xl">
              {ABOUT.measure}
            </p>

            <div className="da-panel-violet mt-10 rounded-2xl p-6 sm:p-7">
              <h3 className="da-display text-xl leading-snug font-semibold tracking-tight text-white sm:text-2xl">{statement.headline}</h3>
              <ul className="mt-4 space-y-1.5">
                {statement.lines.map((line) => (
                  <li key={line} className="da-display text-base font-medium text-[#c3b6fe] sm:text-lg">
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-relaxed text-white/60 sm:text-[15px]">{statement.close}</p>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
              <p className="da-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">{ABOUT.principlesLabel}</p>
              <p className="da-mono flex flex-wrap items-center gap-1.5 text-[10px] tracking-[0.16em] text-white/55 uppercase" aria-label={SITE.values.join(', ')}>
                {SITE.values.map((value, index) => (
                  <span key={value} className="flex items-center gap-1.5">
                    {value}
                    {index < SITE.values.length - 1 ? <ArrowRight className="size-3 text-[#9a88fc]" aria-hidden /> : null}
                  </span>
                ))}
              </p>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {ABOUT.principles.map((principle) => (
                <li key={principle.name} className="rounded-2xl">
                  <MagicCard
                    className="h-full rounded-2xl border border-[#9a88fc]/15 bg-[#16131f]"
                    contentClassName="p-6"
                    gradientColor="rgba(154, 136, 252, 0.16)"
                    gradientFrom="#9a88fc"
                    gradientTo="#c3b6fe"
                  >
                    <div className="flex items-baseline justify-between">
                      <h3 className="da-display text-xl font-semibold tracking-tight text-white">{principle.name}</h3>
                      <span className="font-serif text-2xl text-[#9a88fc]/70 italic">{principle.numeral}</span>
                    </div>
                    <p className="mt-3 text-[14px] leading-relaxed text-[#aaa4c4]">{principle.body}</p>
                  </MagicCard>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </BlurFade>
    </section>
  );
}


/* ------------------------------------------------------------------------ */
/* 07 · Founder                                                              */
/* ------------------------------------------------------------------------ */

export function FounderFull({ standalone = false }: { standalone?: boolean } = {}) {
  const [opening, ...letter] = FOUNDER.paragraphs;
  return (
    <Section id={FOUNDER.id} className={standalone ? 'pt-10 sm:pt-14' : undefined}>
      <div className="da-panel-violet relative overflow-hidden rounded-[28px] px-6 py-12 sm:px-12 sm:py-16 lg:px-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/site/brand/da-crest.png"
          alt=""
          width={382}
          height={512}
          className="pointer-events-none absolute -right-10 -bottom-16 h-[420px] w-auto opacity-[0.05] select-none"
        />
        <div className="relative grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <Eyebrow index={standalone ? undefined : FOUNDER.index}>{FOUNDER.eyebrow}</Eyebrow>
            <h2 className="da-display da-gradient-text-soft mt-5 text-[2rem] leading-[1.08] font-semibold text-balance sm:text-[2.6rem]">
              {FOUNDER.headline}
            </h2>
            <figure className="relative mt-8 max-w-[420px]">
              <div aria-hidden className="absolute -inset-3 rounded-[26px] bg-[#9a88fc]/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-[22px] border border-[#9a88fc]/30 bg-[#0f0d17] p-1.5 shadow-[0_0_72px_-28px_rgba(154,136,252,0.8)]">
                <Image
                  src={FOUNDER.photo.src}
                  width={FOUNDER.photo.width}
                  height={FOUNDER.photo.height}
                  alt={FOUNDER.photo.alt}
                  sizes="(min-width: 1024px) 420px, 90vw"
                  className="h-auto w-full rounded-[17px]"
                />
              </div>
              <figcaption className="relative mt-3 flex items-center justify-between text-sm">
                <span className="da-display font-semibold text-white">{FOUNDER.name}</span>
                <span className="text-[#aaa4c4]">{FOUNDER.title}</span>
              </figcaption>
            </figure>
          </div>
          <div>
            <p className="da-display text-xl leading-snug font-medium text-white sm:text-[1.4rem]">{opening}</p>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-white/70 sm:text-[17px]">
              {letter.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-[#9a88fc]/20 pt-6">
              <div className="flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-full bg-black/50 ring-1 ring-[#9a88fc]/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/site/brand/da-star.png" alt="" width={181} height={256} className="h-6 w-auto" />
                </span>
                <div>
                  <p className="da-display text-lg font-semibold text-white">{FOUNDER.name}</p>
                  <p className="text-sm text-white/50">{FOUNDER.title}</p>
                </div>
              </div>
              <ul className="flex gap-2">
                {SOCIALS.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${FOUNDER.name} on ${social.label}`}
                      className="flex size-10 items-center justify-center rounded-full border border-[#9a88fc]/20 bg-[#16131f] text-white/65 transition-colors hover:border-[#9a88fc]/50 hover:bg-[#5a23fc]/15 hover:text-white"
                    >
                      <SocialIcon id={social.id} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}


/* ------------------------------------------------------------------------ */
/* 10 · Final call to action                                                 */
/* ------------------------------------------------------------------------ */

export function FinalCta() {
  return (
    <section id={FINAL.id} className="relative scroll-mt-28 overflow-hidden pt-16 pb-28 sm:pb-36">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="da-grid absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-[620px] bg-[radial-gradient(46%_60%_at_50%_100%,rgba(90,35,252,0.6)_0%,rgba(90,35,252,0.12)_45%,transparent_75%)]" />
        <div className="absolute top-0 left-1/2 h-px w-[60%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#b59aff]/60 to-transparent" />
      </div>
      <BlurFade inView inViewMargin="-80px" offset={14} blur="4px" duration={0.6} className={`${shell} relative`}>
        <div className="mx-auto flex max-w-3xl flex-col items-center pt-16 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/brand/da-crest.png" alt="" width={382} height={512} className="h-16 w-auto opacity-90 drop-shadow-[0_0_24px_rgba(154,136,252,0.6)]" />
          <Eyebrow index={FINAL.index} className="mt-8 justify-center">
            {FINAL.eyebrow}
          </Eyebrow>
          <h2 className="da-display da-gradient-text mt-5 text-[2.5rem] leading-[1.04] font-semibold text-balance sm:text-6xl lg:text-7xl">{FINAL.headline}</h2>
          <div className="mt-7 space-y-3 text-[15px] leading-relaxed text-[#aaa4c4] sm:text-lg">
            {FINAL.body.map((paragraph, index) => (
              <p key={paragraph} className={index === 0 ? 'text-white/90' : undefined}>
                {paragraph}
              </p>
            ))}
          </div>
          <div className="mt-10">
            <ButtonLink href={DIAGNOSTIC_PATH}>{FINAL.cta}</ButtonLink>
          </div>
        </div>
      </BlurFade>
    </section>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-[#9a88fc]/15 bg-[#09080e]">
      <div className={`${shell} py-16`}>
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/brand/da-wordmark.png" alt="Divine Acquisition" width={900} height={138} className="h-7 w-auto" />
            <p className="da-mono mt-5 text-[11px] tracking-[0.16em] text-white/45 uppercase">{SITE.values.join(' · ')}</p>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/45">{HERO.lead}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {NAV.map((group) => (
              <div key={group.id}>
                <p className="da-mono text-[10px] tracking-[0.18em] text-[#9a88fc] uppercase">{group.label}</p>
                <ul className="mt-4 space-y-2.5">
                  {group.links
                    .filter((link) => !link.muted)
                    .map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                          className="text-sm text-white/60 transition-colors hover:text-white"
                        >
                          {link.label.replace(' Build Out', '')}
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            <div>
              <p className="da-mono text-[10px] tracking-[0.18em] text-[#9a88fc] uppercase">Connect</p>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <a href={DIAGNOSTIC_PATH} className="text-sm text-white/60 transition-colors hover:text-white">
                    Book a diagnostic
                  </a>
                </li>
                {SOCIALS.map((social) => (
                  <li key={social.label}>
                    <a href={social.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white">
                      <SocialIcon id={social.id} className="size-3.5" />
                      {social.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a href={CAREERS_URL} className="text-sm text-white/60 transition-colors hover:text-white">
                    Careers
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-[#9a88fc]/15 pt-6 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SITE.legalName} All rights reserved.
          </p>
          <p className="max-w-xl sm:text-right">
            Third-party names and logos are trademarks of their respective owners and indicate platforms we build with, not partnerships or endorsements.
          </p>
        </div>
      </div>
    </footer>
  );
}


/**
 * A dedicated site page: the nav, a back link to the homepage, the full
 * section, then the closing call to action and footer.
 */
export function SitePage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="pt-20 sm:pt-24">
        <div className={shell}>
          <Link href="/" className="da-mono group inline-flex items-center gap-2 pt-8 text-[11px] tracking-[0.16em] text-white/50 uppercase transition-colors hover:text-white">
            <ArrowRight className="size-3.5 rotate-180 transition-transform group-hover:-translate-x-1" aria-hidden />
            Divine Acquisition
          </Link>
        </div>
        {children}
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
