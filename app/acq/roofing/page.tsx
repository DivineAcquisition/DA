import { CalendarCheck, Check, FileText, PhoneMissed, Plus } from 'lucide-react';

import { embedSrc } from '@/app/acq/components/niche/blocks';
import { VisitCapture } from '@/app/acq/components/niche/NicheExperience';
import { ButtonLink, Eyebrow, Section, SectionHeading, shell } from '@/app/site/components/primitives';
import { BlurFade } from '@/components/ui/blur-fade';
import { BorderBeam } from '@/components/ui/border-beam';
import { MagicCard } from '@/components/ui/magic-card';
import {
  headlineFor,
  offerFoot,
  renderedFaqs,
  renderedOffer,
  renderedSteps,
  ROOFING,
  sourceMark,
  type NicheContent,
} from '@/lib/acq/niche-content';
import { headlineVariantFromUtm, nicheTrackingFromSearch, type HeadlineVariant } from '@/lib/acq/niche-tracking';

import { RoofingFooter, RoofingNav, roofingPaths } from './chrome';

export const dynamic = 'force-dynamic';

const PROBLEM_ICONS = { lead: PhoneMissed, estimate: FileText, inspection: CalendarCheck } as const;

const cardProps = {
  className: 'h-full rounded-[24px] border border-[#9a88fc]/15 bg-[#15131f]',
  gradientColor: 'rgba(154, 136, 252, 0.16)',
  gradientFrom: '#9a88fc',
  gradientTo: '#c3b6fe',
} as const;

function Cta({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-12 flex justify-center">
      <ButtonLink href={href}>{label}</ButtonLink>
    </div>
  );
}

function Video({ video }: { video: NicheContent['video'] }) {
  const url = video.url.trim();
  if (!video.enabled || !url) return null;
  const embed = embedSrc(url);
  return (
    <div className="da-panel relative mt-10 w-full overflow-hidden rounded-[28px] p-1.5 sm:p-2">
      <BorderBeam size={120} duration={10} colorFrom="#9a88fc" colorTo="#c3b6fe" borderWidth={1} />
      <div className="aspect-video overflow-hidden rounded-[22px] bg-black">
        {embed ? (
          <iframe src={embed} title="Short video" loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen className="size-full" />
        ) : (
          <video controls preload="none" playsInline src={url} className="size-full" />
        )}
      </div>
    </div>
  );
}

function Hero({ content, variant, apply }: { content: NicheContent; variant: HeadlineVariant; apply: string }) {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="da-grid absolute inset-0" />
        <div className="da-glow-hero absolute inset-x-0 top-0 h-[1100px]" />
        <div className="da-spotlight absolute inset-x-0 top-0 h-[700px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0b0a11]" />
      </div>

      <div className={`${shell} relative`}>
        <BlurFade offset={10} blur="6px" duration={0.7} className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="da-banner relative inline-flex items-center rounded-full p-px">
            <span className="relative inline-flex items-center gap-3 rounded-full bg-[#110d1d] py-2 pr-5 pl-4">
              <span aria-hidden className="relative flex size-2.5">
                <span className="da-pulse-dot absolute inset-0 rounded-full bg-[#7446ff]" />
                <span className="relative size-2.5 rounded-full bg-gradient-to-b from-[#a78bff] to-[#5a23fc] shadow-[0_0_12px_2px_rgba(90,35,252,0.85)]" />
              </span>
              <span className="da-display text-[13px] font-semibold tracking-[0.01em] text-white sm:text-sm">{content.pill}</span>
            </span>
          </p>
          <h1
            data-headline={variant}
            className="da-display da-gradient-text mt-7 text-[1.85rem] leading-[1.08] font-semibold text-balance sm:text-[2.6rem] lg:text-[3rem]"
          >
            {headlineFor(content, variant)}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl">
            {content.subhead.map((span) => (
              <span key={span.text}>
                {span.text}
                {span.sourceIds?.length ? (
                  <a href="#sources" className="ml-0.5 align-super text-[0.6em] text-[#c3b6fe] no-underline hover:text-white">
                    <span className="sr-only">Sources </span>
                    {sourceMark(content, span.sourceIds)}
                  </a>
                ) : null}
              </span>
            ))}
          </p>
          <Video video={content.video} />
          <div className="mt-9">
            <ButtonLink href={apply}>{content.button}</ButtonLink>
          </div>
          <ul className="mt-7 flex flex-wrap justify-center gap-2">
            {content.chips.map((chip) => (
              <li key={chip} className="inline-flex items-center gap-2 rounded-full border border-[#9a88fc]/20 bg-[#16131f] px-3 py-1.5 text-sm text-white/85">
                <Check className="size-3.5 text-[#9a88fc]" aria-hidden />
                {chip}
              </li>
            ))}
          </ul>
          <p className="da-mono mt-5 text-[11px] tracking-[0.18em] text-white/45 uppercase">{content.quietLine}</p>
        </BlurFade>
      </div>
    </section>
  );
}

export default async function RoofingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const content = ROOFING;
  const tracking = nicheTrackingFromSearch(await searchParams);
  const variant = headlineVariantFromUtm(tracking.utm_content);
  const { apply } = await roofingPaths(tracking);
  const steps = renderedSteps(content);
  const offer = renderedOffer(content);
  const faqs = renderedFaqs(content);
  const labels = content.sectionLabels;

  return (
    <>
      <VisitCapture tracking={tracking} />
      <RoofingNav home="#top" cta={{ href: apply, label: 'Book free audit' }} />
      <main>
        <Hero content={content} variant={variant} apply={apply} />

        <Section id="numbers" className="pt-8 sm:pt-12">
          <SectionHeading index="01" eyebrow={labels.stats} headline={content.statsHeading} align="center" />
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {content.stats.map((stat) => (
              <li key={stat.value}>
                <MagicCard {...cardProps} contentClassName="flex h-full flex-col p-6">
                  <p className="da-display da-gradient-text text-4xl font-semibold">{stat.value}</p>
                  <p className="mt-4 text-[15px] leading-relaxed text-white/80">{stat.label}</p>
                  <p className="mt-auto pt-5 text-xs leading-snug text-white/40">{stat.source}</p>
                </MagicCard>
              </li>
            ))}
          </ul>
          <p className="da-display mt-10 text-center text-lg font-medium text-[#c3b6fe]">{content.statsFoot}</p>
          <Cta href={apply} label={content.button} />
        </Section>

        <Section id="problem">
          <SectionHeading index="02" eyebrow={content.problem.eyebrow} headline={content.problem.heading} lead={content.problem.body} />
          <p className="da-mono mt-14 text-[11px] tracking-[0.18em] text-white/55 uppercase">{content.problem.placesHeading}</p>
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {content.problem.places.map((place) => {
              const Icon = PROBLEM_ICONS[place.icon];
              return (
                <li key={place.title} className="da-panel rounded-2xl p-6">
                  <span className="da-icon-tile flex size-11 items-center justify-center rounded-xl">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="da-display mt-5 text-xl font-semibold text-white">{place.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#aaa4c4]">{place.text}</p>
                </li>
              );
            })}
          </ul>
          <p className="da-display mt-10 border-l border-[#9a88fc]/40 pl-5 text-lg font-medium text-white sm:text-xl">{content.problem.closing}</p>
          <Cta href={apply} label={content.button} />
        </Section>

        <Section id="fix">
          <div className="da-panel-violet relative overflow-hidden rounded-[28px] p-6 sm:p-10 lg:p-12">
            <Eyebrow index="03">{labels.need}</Eyebrow>
            <h2 className="da-display da-gradient-text-soft mt-5 max-w-3xl text-[2rem] leading-[1.06] font-semibold text-balance sm:text-5xl">{content.need.heading}</h2>
            <ol className="mt-10 grid gap-3 md:grid-cols-3">
              {content.need.items.map((item, index) => (
                <li key={item.title} className="rounded-2xl border border-[#9a88fc]/15 bg-[#16131f] p-5">
                  <span className="da-mono text-xs text-[#9a88fc]">0{index + 1}</span>
                  <h3 className="da-display mt-2 text-lg font-semibold tracking-tight text-white">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#aaa4c4]">{item.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-[15px] text-white/85 sm:text-base">{content.need.foot}</p>
          </div>
          <Cta href={apply} label={content.button} />
        </Section>

        <Section id="install">
          <SectionHeading index="04" eyebrow={content.offer.eyebrow} headline={content.offer.heading} />
          <ul className="mt-14 grid gap-4 md:grid-cols-2">
            {offer.map((item, index) => (
              <li key={item.title}>
                <MagicCard {...cardProps} contentClassName="flex h-full flex-col p-6 sm:p-7">
                  <span className="da-mono text-xs text-[#9a88fc]">0{index + 1}</span>
                  <h3 className="da-display mt-2 text-xl font-semibold text-white">{item.title}</h3>
                  <ul className="mt-4 space-y-2.5">
                    {item.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2.5 text-[15px] leading-relaxed text-white/80">
                        <Check className="mt-1 size-4 shrink-0 text-[#9a88fc]" aria-hidden />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-auto border-t border-[#9a88fc]/15 pt-4 text-sm leading-relaxed text-[#aaa4c4]">
                    <span className="font-medium text-white">Done when:</span> {item.done}
                  </p>
                </MagicCard>
              </li>
            ))}
          </ul>
          <p className="mt-8 rounded-2xl border border-[#9a88fc]/20 bg-[#16131f] px-5 py-4 text-[15px] leading-relaxed text-white/85">{offerFoot(content)}</p>
          <Cta href={apply} label={content.button} />
        </Section>

        <Section id="audit">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <SectionHeading index="05" eyebrow={labels.why} headline={content.why.heading} lead={content.why.body} />
              <ol className="mt-8 space-y-3">
                {content.why.checks.map((line, index) => (
                  <li key={line} className="flex items-baseline gap-4">
                    <span className="da-mono text-xs text-[#9a88fc]">0{index + 1}</span>
                    <span className="da-display text-lg font-medium tracking-tight text-white sm:text-xl">{line}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-8 border-l border-[#9a88fc]/40 pl-5 text-[15px] leading-relaxed text-white/85 sm:text-base">{content.why.after}</p>
            </div>
            <div className="space-y-4">
              <ul className="space-y-3">
                {content.commitments.map((line) => (
                  <li key={line} className="flex items-start gap-3 rounded-xl border border-[#9a88fc]/15 bg-[#16131f] p-4 text-[15px] text-white/85">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#52d6a4]" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
              <article className="da-panel-violet relative overflow-hidden rounded-2xl p-6">
                <p className="da-mono text-[10px] tracking-[0.18em] text-[#c3b6fe] uppercase">{content.proof.label}</p>
                <p className="da-display mt-3 text-lg leading-snug font-medium text-white">{content.proof.text}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{content.proof.honesty}</p>
              </article>
            </div>
          </div>
          <Cta href={apply} label={content.button} />
        </Section>

        <Section id="fit">
          <SectionHeading index="06" eyebrow={labels.fit} headline={content.fitHeading} align="center" />
          <div className="mx-auto mt-14 grid max-w-4xl gap-4 md:grid-cols-2">
            <div className="da-panel-violet relative overflow-hidden rounded-2xl p-6 sm:p-7">
              <p className="da-mono text-[11px] tracking-[0.18em] text-[#52d6a4] uppercase">{content.fit.title}</p>
              <p className="mt-4 text-[15px] leading-relaxed text-white/85">{content.fit.text}</p>
            </div>
            <div className="da-panel rounded-2xl p-6 sm:p-7">
              <p className="da-mono text-[11px] tracking-[0.18em] text-[#f87171] uppercase">{content.notFit.title}</p>
              <p className="mt-4 text-[15px] leading-relaxed text-[#aaa4c4]">{content.notFit.text}</p>
            </div>
          </div>
        </Section>

        <Section id="process">
          <SectionHeading index="07" eyebrow={labels.steps} headline={content.stepsHeading} />
          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="da-panel rounded-2xl p-6">
                <span className="da-mono flex size-8 items-center justify-center rounded-full bg-[#5a23fc] text-xs text-white">{index + 1}</span>
                <h3 className="da-display mt-5 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#aaa4c4]">{step.body}</p>
              </li>
            ))}
          </ol>
          <Cta href={apply} label={content.button} />
        </Section>

        <Section id="faq">
          <SectionHeading index="08" eyebrow={labels.faq} headline={content.faqHeading} align="center" />
          <div className="mx-auto mt-14 max-w-3xl space-y-3">
            {faqs.map((item) => (
              <details key={item.question} className="group da-panel rounded-2xl px-5 py-4 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left [&::-webkit-details-marker]:hidden">
                  <span className="da-display text-base font-medium text-white sm:text-lg">{item.question}</span>
                  <Plus className="size-4 shrink-0 text-[#c3b6fe] transition-transform group-open:rotate-45" aria-hidden />
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-[#aaa4c4]">{item.answer}</p>
              </details>
            ))}
          </div>
        </Section>

        <section id="final" className="relative scroll-mt-28 overflow-hidden pt-16 pb-28 sm:pb-36">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="da-grid absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 h-[620px] bg-[radial-gradient(46%_60%_at_50%_100%,rgba(90,35,252,0.6)_0%,rgba(90,35,252,0.12)_45%,transparent_75%)]" />
            <div className="absolute top-0 left-1/2 h-px w-[60%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#b59aff]/60 to-transparent" />
          </div>
          <BlurFade inView inViewMargin="-80px" offset={14} blur="4px" duration={0.6} className={`${shell} relative`}>
            <div className="mx-auto flex max-w-3xl flex-col items-center pt-16 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/site/brand/da-crest.png" alt="" width={382} height={512} className="h-16 w-auto opacity-90 drop-shadow-[0_0_24px_rgba(154,136,252,0.6)]" />
              <Eyebrow index="09" className="mt-8 justify-center">
                {labels.final}
              </Eyebrow>
              <h2 className="da-display da-gradient-text mt-5 text-[2.5rem] leading-[1.04] font-semibold text-balance sm:text-6xl">{content.finalCta.heading}</h2>
              <p className="mt-7 text-[15px] leading-relaxed text-white/90 sm:text-lg">{content.finalCta.text}</p>
              <div className="mt-10">
                <ButtonLink href={apply}>{content.button}</ButtonLink>
              </div>
            </div>
          </BlurFade>
        </section>
      </main>

      <RoofingFooter links={[{ href: apply, label: 'Book a free audit' }, { href: '#faq', label: 'Questions' }]}>
        <div id="sources" className="mt-12 scroll-mt-28 border-t border-[#9a88fc]/15 pt-6">
          <p className="da-mono text-[10px] tracking-[0.18em] text-[#9a88fc] uppercase">{content.sourcesLabel}</p>
          <ol className="mt-4 space-y-2 text-sm text-white/55">
            {content.sources.map((source) => (
              <li key={source.id} id={`source-${source.n}`} className="flex gap-2">
                <span className="da-mono text-xs text-white/40">{source.n}.</span>
                <a href={source.href} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
                  {source.listing}
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-white/40">{content.sourcesNote}</p>
        </div>
      </RoofingFooter>
    </>
  );
}
