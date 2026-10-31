import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { wistiaAspectRatio } from '@/lib/go/config';
import {
  CALENDAR,
  FACEBOOK_DISCLAIMER,
  PILL_BANNER,
  TESTIMONIALS,
  TESTIMONIALS_HEADLINE,
  TESTIMONIALS_LEAD,
} from '@/lib/go/copy';
import { cookies } from 'next/headers';
import IclosedEmbed from '@/app/acq/components/IclosedEmbed';
import { ACQ_ICLOSED_TITLE } from '@/lib/acq/config';
import { revenueLeakEmbedUrl } from '@/lib/acq/revenue-leak';
import { REVENUE_LEAK } from '@/lib/acq/revenue-leak-content';
import { nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';
import { GoWistia } from './components/GoWistia';

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
    <div className="acq-coaches min-h-screen antialiased">
      <section className="lx-hero go-hero">
        <div className="lx-wrap lx-hero-inner">
          <AnimatedShinyText className="lx-pill mx-0 max-w-none text-brand-300">{PILL_BANNER}</AnimatedShinyText>
          <h1 className="lx-headline go-hero-title">
            We&apos;ll Book <span className="lx-accent">10 First Cleans</span> From Homeowners Who Only Talked To You,
            Then Turn Them Into <span className="lx-accent">Recurring Clients.</span>
            <span className="go-hero-close">Done For You, Ads Live In 7 Days.</span>
          </h1>
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
          <IclosedEmbed
            url={calendarSrc}
            title={ACQ_ICLOSED_TITLE}
            contentName="Cleaning strategy session"
            contentCategory="cleaning"
            eventName="Schedule"
          />
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

      <footer className="lx-foot">
        <ul className="go-foot-links">
          <li>
            <a href="#calendar">Book a session</a>
          </li>
          <li>
            <a href="#results">Results</a>
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
