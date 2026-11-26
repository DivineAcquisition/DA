import { Geist_Mono } from 'next/font/google';
import { cookies } from 'next/headers';

import IclosedEmbed from '@/app/acq/components/IclosedEmbed';
import { interDisplay } from '@/app/fonts/inter-display';
import { ButtonLink, Eyebrow, Section, SectionHeading, shell } from '@/app/site/components/primitives';
import '@/app/site/site.css';
import { BorderBeam } from '@/components/ui/border-beam';
import { BlurFade } from '@/components/ui/blur-fade';
import { MagicCard } from '@/components/ui/magic-card';
import { ACQ_ICLOSED_HOME_SERVICE_TITLE } from '@/lib/acq/config';
import { nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';
import { revenueLeakEmbedUrl } from '@/lib/acq/revenue-leak';
import { REVENUE_LEAK } from '@/lib/acq/revenue-leak-content';
import { GO_VSL_MEDIA_ID, wistiaAspectRatio } from '@/lib/go/config';
import {
  CALENDAR,
  CTA_LABEL,
  FACEBOOK_DISCLAIMER,
  HEADLINE_MAIN,
  PILL_BANNER,
  TESTIMONIALS,
  TESTIMONIALS_HEADLINE,
  TESTIMONIALS_LEAD,
  VIDEO_LABEL,
} from '@/lib/go/copy';

import { GoWistia } from './components/GoWistia';

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

function CleaningNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between rounded-2xl border border-[#9a88fc]/15 bg-[#12101a]/80 pr-2 pl-4 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:pl-5">
        <a href="#top" aria-label="Divine Acquisition" className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#9a88fc]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/brand/da-wordmark.png" alt="Divine Acquisition" width={900} height={138} className="h-[22px] w-auto sm:h-6" />
        </a>
        <a href="#calendar" className="da-btn-primary inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-white">
          <span className="relative z-[1]">{CTA_LABEL}</span>
        </a>
      </div>
    </header>
  );
}

function Hero() {
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
              <span className="da-display text-[13px] font-semibold tracking-[0.01em] text-white sm:text-sm">{PILL_BANNER}</span>
            </span>
          </p>
          <h1 className="da-display da-gradient-text go-hero-title mt-7 text-[2.15rem] leading-[1.05] font-bold text-balance sm:text-5xl lg:text-[3.35rem]">
            {HEADLINE_MAIN}
          </h1>
          <p className="da-mono mt-8 text-[11px] tracking-[0.18em] text-[#c3b6fe]/80 uppercase">{VIDEO_LABEL}</p>
          <div className="da-panel relative mt-5 w-full overflow-hidden rounded-[28px] p-1.5 sm:p-2">
            <BorderBeam size={120} duration={10} colorFrom="#9a88fc" colorTo="#c3b6fe" borderWidth={1} />
            <div className="overflow-hidden rounded-[22px] bg-black">
              <GoWistia mediaId={GO_VSL_MEDIA_ID} />
            </div>
          </div>
          <div className="mt-8">
            <ButtonLink href="#calendar">{CTA_LABEL}</ButtonLink>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}

export default async function CleaningFunnelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tracking = nicheTrackingFromSearch(await searchParams);
  const jar = await cookies();
  const calendarSrc = revenueLeakEmbedUrl(REVENUE_LEAK.booking.url, tracking, {
    fbp: jar.get('_fbp')?.value,
    fbc: jar.get('_fbc')?.value,
  });

  return (
    <div className={`${interDisplay.variable} ${geistMono.variable} da-site min-h-screen`}>
      <CleaningNav />
      <main>
        <Hero />

        <Section id="calendar" className="pt-8 sm:pt-12">
          <SectionHeading
            index="01"
            eyebrow={CALENDAR.eyebrow}
            headline={`${CALENDAR.titleBefore}${CALENDAR.titleAccent}${CALENDAR.titleAfter}`}
            lead={CALENDAR.body}
            align="center"
          />
          <IclosedEmbed
            url={calendarSrc}
            title={ACQ_ICLOSED_HOME_SERVICE_TITLE}
            contentName="Cleaning strategy session"
            contentCategory="cleaning"
            eventName="Schedule"
            shell={false}
            className="max-w-5xl"
          />
        </Section>

        <Section id="results">
          <SectionHeading index="02" eyebrow="Real results" headline={TESTIMONIALS_HEADLINE} lead={TESTIMONIALS_LEAD} align="center" />
          <ul className="mt-14 grid list-none items-start gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <li key={item.name}>
                <MagicCard
                  className="rounded-[24px] border border-[#9a88fc]/15 bg-[#15131f]"
                  contentClassName="flex flex-col p-5 sm:p-6"
                  gradientColor="rgba(154, 136, 252, 0.16)"
                  gradientFrom="#9a88fc"
                  gradientTo="#c3b6fe"
                >
                  <Eyebrow>{item.videoId ? 'Live testimonial' : 'Interview coming soon'}</Eyebrow>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="da-icon-tile flex size-11 items-center justify-center rounded-xl text-sm font-semibold">{item.initials}</span>
                    <div>
                      <p className="da-display text-base font-semibold text-white">{item.name}</p>
                      <p className="text-sm text-white/50">{item.role}</p>
                    </div>
                  </div>
                  <div className={item.videoAspect === '9/16' ? 'mx-auto mt-5 w-full max-w-[280px] overflow-hidden rounded-2xl bg-black' : 'mt-5 overflow-hidden rounded-2xl bg-black'}>
                    {item.videoId ? (
                      <GoWistia mediaId={item.videoId} aspect={wistiaAspectRatio(item.videoAspect)} />
                    ) : (
                      <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-white/45">
                        Nathan&apos;s interview is being recorded.
                      </div>
                    )}
                  </div>
                  <blockquote className="mt-5 text-[15px] leading-relaxed text-white/80">&ldquo;{item.quote}&rdquo;</blockquote>
                  <ul className="mt-5 grid grid-cols-3 gap-2 border-t border-[#9a88fc]/15 pt-4">
                    {item.stats.map((stat) => (
                      <li key={stat.label}>
                        <p className="da-display text-lg font-semibold text-white">{stat.value}</p>
                        <p className="mt-1 text-[11px] leading-snug text-white/45">{stat.label}</p>
                      </li>
                    ))}
                  </ul>
                </MagicCard>
              </li>
            ))}
          </ul>
        </Section>
      </main>

      <footer className="relative border-t border-[#9a88fc]/15 bg-[#09080e]">
        <div className={`${shell} py-16`}>
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/site/brand/da-wordmark.png" alt="Divine Acquisition" width={900} height={138} className="h-7 w-auto" />
              <p className="da-mono mt-5 text-[11px] tracking-[0.16em] text-white/45 uppercase">Book · Follow up · Keep the client</p>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
              <li>
                <a href="#calendar" className="transition-colors hover:text-white">
                  Book a session
                </a>
              </li>
              <li>
                <a href="#results" className="transition-colors hover:text-white">
                  Results
                </a>
              </li>
              <li>
                <a href="mailto:hello@divineacquisition.io" className="transition-colors hover:text-white">
                  hello@divineacquisition.io
                </a>
              </li>
            </ul>
          </div>
          <div className="mt-14 space-y-3 border-t border-[#9a88fc]/15 pt-6 text-xs leading-relaxed text-white/35">
            <p>© {new Date().getFullYear()} Divine Acquisition. All rights reserved.</p>
            <p className="max-w-3xl">{FACEBOOK_DISCLAIMER}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
