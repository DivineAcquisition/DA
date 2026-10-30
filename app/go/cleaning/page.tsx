import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import {
  CLEANING_CTA,
  CLEANING_STICKY_CTA,
  cleaningComparison,
  cleaningFaqs,
  cleaningFoundingBar,
  cleaningGateLine,
  cleaningHeadline,
  cleaningProofLine,
} from '@/lib/cleaning/copy';
import { cleaningFee, cleaningSettings } from '@/lib/cleaning/settings';
import { AuditForm } from './AuditForm';
import { CleaningPageView } from './Pixel';
import './cleaning.css';

const settings = cleaningSettings;
const offerOn = settings.foundingPartnerOffer;
const headline = cleaningHeadline();

export const metadata: Metadata = {
  title: { absolute: 'Divine Acquisition | Own Your Leads for Cleaning Companies' },
  description:
    'Exclusive quote requests from your own ads, a first text within minutes, a real person who books the first clean with the recurring plan, and follow-up after every clean. Founding partners pay only when a client goes recurring.',
  openGraph: {
    title: 'Divine Acquisition | Own Your Leads for Cleaning Companies',
    description:
      'Exclusive quote requests from your own ads, a first text within minutes, a real person who books the first clean with the recurring plan, and follow-up after every clean. Founding partners pay only when a client goes recurring.',
    images: [{ url: '/cleaning/finished-home.svg', alt: 'A bright finished home' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Divine Acquisition | Own Your Leads for Cleaning Companies',
    description:
      'Exclusive quote requests from your own ads, a first text within minutes, a real person who books the first clean with the recurring plan, and follow-up after every clean. Founding partners pay only when a client goes recurring.',
    images: ['/cleaning/finished-home.svg'],
  },
};

const leaks = [
  ['The quote request four other companies also got.', 'You paid for it, and so did everyone else on the list. The homeowner booked whoever answered first or quoted lowest.'],
  ['The request that came in at 9 p.m.', 'It sat until your VA logged on the next morning. By then they\'d already booked someone else.'],
  ['The one-time clean that never came back.', 'Great clean, happy customer, and nobody ever offered them a recurring plan. Or they said "we\'ll let you know" and you never heard from them again.'],
  ['The cancelled client nobody called.', 'They paused for the holidays or a budget squeeze. Six months later they\'re with another company, and nobody on your team ever reached out.'],
  ['The marketing bill with nothing to show.', 'Software, a VA, a lead service, maybe an agency. Every month you pay, and you still can\'t say how many recurring clients it produced.'],
] as const;

const reasons = [
  'Slow first reply. Homeowners who request quotes usually reach out to more than one company, and the first one to answer has the advantage.',
  "Competing on price for shared leads. When five companies get the same request, it turns into a price war you can't win on thin margins.",
  'Nobody sells the recurring plan. A first clean booked without a frequency conversation is usually a one-time clean.',
  'No follow-up after the clean. No check-in, no review request, no win-back when a client pauses.',
] as const;

const engine = [
  ['Exclusive leads from your own ad account.', 'Fixes: shared leads.', 'We run Meta ads in your service area using your real before-and-after photos, in an ad account you own. Every lead is yours. Never resold.'],
  ['A first text within minutes.', 'Fixes: late-night requests.', 'Between 8 a.m. and 8 p.m., every new request gets a text within minutes from an automated assistant for your company that says what it is. Requests after 8 p.m. get it first thing in the morning.'],
  ['Screened and quoted the way you want.', 'Fixes: price shoppers.', 'The assistant asks about home size, bedrooms and bathrooms, type of clean, how often they want it, and timing, using your pricing rules. Requests outside your area or services never reach your schedule.'],
  ['A real person books the first clean, with the recurring plan on the table.', 'Fixes: one-time cleans.', 'Someone on our team calls or texts every qualified homeowner, answers questions, and books the first clean in your booking software, offering weekly, biweekly, or monthly from the start.'],
  ['Follow-up after the clean.', 'Fixes: cancelled and lost clients.', "After the first clean: a check-in, a review request, and a recurring-plan offer if they haven't picked one. Clients who pause or cancel get a win-back message in your company's name. Any reply goes straight to your team."],
] as const;

const columns = ['Lead services', 'Typical marketing agency', 'Your VA alone', 'Own Your Leads'] as const;

function Cta() {
  return (
    <a className="acq-button clean-cta" href="#request">
      {CLEANING_CTA}
    </a>
  );
}

export default function CleaningPage() {
  const rows = cleaningComparison();
  return (
    <div className="acq-coaches clean-page">
      <CleaningPageView />
      {offerOn ? <p className="clean-bar">{cleaningFoundingBar()}</p> : null}
      <header className="clean-top">
        <Link href="/cleaning" aria-label="Divine Acquisition">
          <Logo className="h-7 w-auto" />
        </Link>
        <a className="acq-button" href="#request">
          {CLEANING_STICKY_CTA}
        </a>
      </header>

      <main>
        <section className="clean-hero">
          <div className="clean-wrap">
            <p className="clean-pill">ATTENTION: RESIDENTIAL CLEANING COMPANY OWNERS</p>
            <h1>
              {headline.start} <span className="clean-drop-mobile">{headline.dropOnPhone} </span>
              {headline.end}
            </h1>
            <p className="clean-proof">{cleaningProofLine()}</p>
            {settings.mysteryShopStat ? <p className="clean-proof clean-proof-extra">{settings.mysteryShopStat}</p> : null}
            <p className="clean-sub">
              We run Meta ads in your own account, text every new quote request within minutes between 8 a.m. and 8 p.m., a real person on our team books the first clean with the recurring plan on the table, and we follow up after the clean to keep them coming back.
            </p>
            <p className="clean-gate">{cleaningGateLine()}</p>
            <Cta />
            <ul className="clean-chips">
              <li>Pay only when a client goes recurring</li>
              <li>One company per market</li>
              <li>You keep the ad account</li>
            </ul>
            <div className="clean-shot" role="img" aria-label="A bright finished kitchen" />
          </div>
        </section>

        <section className="clean-section clean-glow" aria-labelledby="problem">
          <div className="clean-wrap">
            <h2 id="problem">You&apos;re not short on quote requests. You&apos;re losing clients between the first message and the second clean.</h2>
            <p>If you&apos;ve run a cleaning company for more than a year, you&apos;ve lived every one of these.</p>
            <ul className="clean-cards">
              {leaks.map(([title, body]) => (
                <li key={title} className="clean-card">
                  <span className="clean-icon" aria-hidden>
                    ●
                  </span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ul>
            <p className="clean-close">
              Every one of these happens after you&apos;ve already paid for the lead. <strong>That&apos;s the gap, and it&apos;s where your margin goes.</strong>
            </p>
            <Cta />
          </div>
        </section>

        <section className="clean-section clean-glow" aria-labelledby="reasons">
          <div className="clean-wrap">
            <h2 id="reasons">The real reasons good clients go to someone else</h2>
            <ol className="clean-reasons">
              {reasons.map((line) => (
                <li key={line} className="clean-card">
                  <span className="clean-icon" aria-hidden>
                    ●
                  </span>{' '}
                  {line}
                </li>
              ))}
            </ol>
            <p className="clean-card">An agency that owns your ad account means every restart begins from zero.</p>
          </div>
        </section>

        <section className="clean-section" aria-labelledby="engine">
          <div className="clean-wrap">
            <h2 id="engine">The Owned Booking Engine</h2>
            <p>Your ads. A fast first text. A real person who books. Follow-up that keeps clients coming back.</p>
            <ol className="clean-engine">
              {engine.map(([title, fix, body], index) => (
                <li key={title} className="clean-panel">
                  <span className="clean-num">{index + 1}</span>
                  <h3>{title}</h3>
                  <p className="clean-fix">{fix}</p>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
            <Cta />
          </div>
        </section>

        <section className="clean-section" aria-labelledby="get">
          <div className="clean-wrap">
            <h2 id="get">What you get</h2>
            <ol className="clean-gets">
              <li className="clean-panel">
                <h3>
                  {settings.firstCleans} first cleans booked within {settings.promiseWindow}.
                </h3>
                <p>Each one meets a written definition we agree on before launch: in your service area, a home and service type you clean, at or above your minimum price, and booked in your system.</p>
              </li>
              <li className="clean-panel">
                <h3>Ads live in {settings.launchTime}.</h3>
                <p>Your part: a kickoff call, 15 to 20 real before-and-after or team photos, access to your ad account, page, and booking software or calendar, and your pricing rules.</p>
              </li>
              <li className="clean-panel">
                <h3>You own all of it.</h3>
                <p>Ad account, page, pixel, leads, and follow-up. If you leave, everything stays with you.</p>
              </li>
            </ol>
            <p className="clean-score">Every week you get five numbers: quote requests, first cleans booked, cleans completed, new recurring clients, and win-backs. No vanity metrics.</p>
          </div>
        </section>

        <section className="clean-section" aria-labelledby="deal">
          <div className="clean-wrap">
            {offerOn ? (
              <>
                <h2 id="deal">You only pay when a new client goes recurring.</h2>
                <p>We&apos;re taking {settings.foundingSpotsPerMarket} founding partners per market to build our next cleaning case studies.</p>
                <ul className="clean-checks">
                  <li>No setup fee. No monthly fee.</li>
                  <li>You pay Meta directly from your own account, at least {settings.minimumAdBudget}.</li>
                  <li>We earn {cleaningFee()} for each new client from our ads who completes a first clean and is booked on a recurring plan.</li>
                  <li>We charge after their first recurring clean is completed. Never before.</li>
                  <li>Every client is checked in your own booking software, so you see exactly what you&apos;re paying for.</li>
                  <li>Leave with 30 days&apos; notice. No long contract.</li>
                  <li>In return, a short case study interview once we&apos;ve earned it.</li>
                </ul>
                <div className="clean-guarantee">
                  <h3>Our guarantee</h3>
                  <p>
                    If we don&apos;t book {settings.firstCleans} first cleans within {settings.promiseWindow}, we keep working and your next {settings.feeFreeClients} new recurring clients are fee-free. And if you leave, you keep the ads, the pixel, and every lead.
                  </p>
                </div>
                <Cta />
              </>
            ) : (
              <>
                <h2 id="deal">Pricing is set after your audit.</h2>
                <Cta />
              </>
            )}
          </div>
        </section>

        <section className="clean-section" aria-labelledby="compare">
          <div className="clean-wrap">
            <h2 id="compare">What you&apos;ve tried vs. Own Your Leads</h2>
            <div className="clean-compare">
              {columns.map((name, column) => (
                <article key={name} className={column === 3 ? 'clean-panel clean-ours' : 'clean-panel'}>
                  <h3>{name}</h3>
                  {rows.map((row) => (
                    <p key={row[0]}>
                      <span className="clean-muted">{row[0]}</span>
                      <br />
                      <span className={row[column + 1] === 'Yes' || String(row[column + 1]).startsWith('Yes') || (column === 3 && row[0] === 'When you pay') ? 'clean-yes' : 'clean-no'}>
                        {row[column + 1]}
                      </span>
                    </p>
                  ))}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="clean-section" aria-labelledby="why">
          <div className="clean-wrap">
            <h2 id="why">Why is the Lead Leak Audit free?</h2>
            <p>Because before we talk, we request a quote from your company the way a homeowner would and time the reply. Most owners are surprised by the result.</p>
            <ul className="clean-cards">
              {[
                "You're paying for leads and can't say how many became recurring clients.",
                'You have one-time customers from the last 90 days who were never offered a plan.',
                'Quote requests that come in at night or on weekends wait until someone logs on.',
                'You have a list of past and cancelled clients nobody has contacted.',
              ].map((item) => (
                <li key={item} className="clean-panel">
                  {item}
                </li>
              ))}
            </ul>
            <p>In 30 minutes we show you your reply time, look at where your leads come from, how many one-time cleans became recurring, and how big your past-customer list is.</p>
            <p>Then we put a dollar figure on the leak using your own prices. You keep the findings either way. We also check whether your market is open.</p>
            <Cta />
          </div>
        </section>

        <section className="clean-section" aria-labelledby="proof">
          <div className="clean-wrap">
            <h2 id="proof">We run a cleaning company too</h2>
            <p>Divine Acquisition runs its own residential cleaning company in the DMV.</p>
            <p>We built the lead response and follow-up system that helped another cleaning company add {settings.proofStat} in new annual revenue.</p>
            <p>We know the margins, the cancellations, and the late-night quote requests because we deal with them ourselves.</p>
            <div className="clean-proof-row">
              <article className="clean-panel">
                <h3>{settings.proofStat}</h3>
                <p>Cleaning company, new annual revenue</p>
              </article>
              <article className="clean-panel">
                <h3>Own cleaning company</h3>
                <p>We run the same playbook on our own business</p>
              </article>
            </div>
            <div className="clean-proof-row">
              <article className="clean-phone">
                <h3>Sample first text</h3>
                <p>Hi, this is an automated assistant for your cleaning company. You asked about a clean. How many bedrooms and bathrooms, and would you want it weekly, biweekly, or monthly?</p>
              </article>
              <article className="clean-panel">
                <h3>Sample recurring offer script</h3>
                <p>Most homes like yours stay on a biweekly plan so the first clean doesn&apos;t wear off.</p>
                <p>Want me to book the first clean and put you on biweekly after that?</p>
              </article>
              <article className="clean-panel">
                <h3>Sample weekly scorecard</h3>
                <p>Quote requests: —</p>
                <p>First cleans booked: —</p>
                <p>Cleans completed: —</p>
                <p>New recurring clients: —</p>
                <p>Win-backs: —</p>
              </article>
            </div>
            {/* Static SVG placeholder. next/image does not optimize SVG. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="clean-shot" src="/cleaning/finished-home.svg" alt="A bright finished living room" loading="lazy" />
          </div>
        </section>

        <section className="clean-section" aria-labelledby="fit">
          <div className="clean-wrap">
            <h2 id="fit">Who it&apos;s for</h2>
            <div className="clean-fit">
              <article className="clean-panel">
                <h3>Built for you if</h3>
                <ul>
                  <li>You run a residential cleaning company doing $15K or more a month</li>
                  <li>Most of your revenue is or could be recurring cleans</li>
                  <li>Your teams can take on more homes</li>
                  <li>You can put at least {settings.minimumAdBudget} a month into ads</li>
                  <li>You use booking software or a shared calendar we can book into</li>
                  <li>You want to step out of the day-to-day, not back into it</li>
                  <li>You&apos;ll let us see new client records so fees are easy to verify</li>
                </ul>
              </article>
              <article className="clean-panel clean-not">
                <h3>Not a fit if</h3>
                <ul>
                  <li>You&apos;re a solo cleaner without a team</li>
                  <li>You only do commercial or janitorial work</li>
                  <li>Your schedule is full and you can&apos;t hire</li>
                  <li>You compete only on the lowest price</li>
                  <li>You won&apos;t honor the first cleans we book</li>
                  <li>You&apos;re not comfortable sharing booking records</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="clean-section">
          <div className="clean-wrap">
            <div className="clean-banner">
              <h2>One cleaning company per market.</h2>
              <p>We work with one residential cleaning company in each service area, so we never run ads against our own client. Once your area is taken, it&apos;s closed.</p>
            </div>
          </div>
        </section>

        <section className="clean-section" aria-labelledby="faq">
          <div className="clean-wrap clean-faq">
            <h2 id="faq">FAQ</h2>
            {cleaningFaqs().map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="clean-section" aria-labelledby="final">
          <div className="clean-wrap">
            <h2 id="final">Find out how many clients are leaking out of your pipeline.</h2>
            <p>Request your free 30-minute Lead Leak Audit. Malik will call you back to set it up, and before the audit we&apos;ll time how fast your company answers a quote request.</p>
            <Cta />
            <AuditForm />
          </div>
        </section>
      </main>

      <footer className="clean-footer">
        <div className="clean-wrap">
          <p>Divine Acquisition LLC, Lanham, Maryland.</p>
          <p>
            <a href={LEGAL_PRIVACY_URL}>Privacy Policy</a>
            {' · '}
            <a href={LEGAL_TERMS_URL}>Terms</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
