import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import {
  CLEANING_CTA,
  CLEANING_STICKY_CTA,
  cleaningFaqs,
  cleaningFoundingBar,
  cleaningGateLine,
  cleaningHeadline,
  cleaningProofLine,
} from '@/lib/cleaning/copy';
import { cleaningFee, cleaningSettings } from '@/lib/cleaning/settings';
import { AuditForm } from './cleaning/AuditForm';
import { CleaningPageView } from './cleaning/Pixel';
import './cleaning/cleaning.css';

const settings = cleaningSettings;
const offerOn = settings.foundingPartnerOffer;
const headline = cleaningHeadline();

export const metadata: Metadata = {
  title: { absolute: 'Divine Acquisition | Own Your Leads for Cleaning Companies' },
  description:
    'Exclusive quote requests from your own ads, a first text within minutes, and a person who books the first clean on a recurring plan. You pay only when a client goes recurring.',
  openGraph: {
    title: 'Divine Acquisition | Own Your Leads for Cleaning Companies',
    description:
      'Exclusive quote requests from your own ads, a first text within minutes, and follow-up after every clean. You pay only when a client goes recurring.',
    url: 'https://go.divineacquisition.io/',
    images: [{ url: '/cleaning/finished-home.svg', alt: 'A bright finished home' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Divine Acquisition | Own Your Leads for Cleaning Companies',
    description:
      'Exclusive quote requests from your own ads, a first text within minutes, and follow-up after every clean. You pay only when a client goes recurring.',
    images: ['/cleaning/finished-home.svg'],
  },
};

function Cta() {
  return (
    <a className="acq-button clean-cta" href="#request">
      {CLEANING_CTA}
    </a>
  );
}

export default function CleaningHomePage() {
  return (
    <div className="acq-coaches clean-page">
      <CleaningPageView />
      {offerOn ? <p className="clean-bar">{cleaningFoundingBar()}</p> : null}
      <header className="clean-top">
        <Link href="/" aria-label="Divine Acquisition">
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
              {headline.start} {headline.end}
            </h1>
            <p className="clean-proof">{cleaningProofLine()}</p>
            {settings.mysteryShopStat ? <p className="clean-proof clean-proof-extra">{settings.mysteryShopStat}</p> : null}
            <p className="clean-sub">
              We run the ads in your account, text new quote requests within minutes from 8 a.m. to 8 p.m., and a person on our team books the first clean with a recurring plan.
            </p>
            <p className="clean-gate">{cleaningGateLine()}</p>
            <Cta />
            <ul className="clean-chips">
              <li>Pay only when a client goes recurring</li>
              <li>One company per market</li>
              <li>You keep the ad account</li>
            </ul>
          </div>
        </section>

        <section className="clean-section clean-glow">
          <div className="clean-wrap">
            <h2>You&apos;re losing clients between the quote request and the second clean.</h2>
            <ul className="clean-cards">
              <li className="clean-card">
                <h3>The same request went to other companies.</h3>
                <p>The homeowner booked whoever answered first or quoted lowest.</p>
              </li>
              <li className="clean-card">
                <h3>It came in after your VA logged off.</h3>
                <p>By morning they had already booked someone else.</p>
              </li>
              <li className="clean-card">
                <h3>The one-time clean never came back.</h3>
                <p>Nobody offered a weekly, biweekly, or monthly plan, or called when they cancelled.</p>
              </li>
            </ul>
            <Cta />
          </div>
        </section>

        <section className="clean-section">
          <div className="clean-wrap">
            <h2>The Owned Booking Engine</h2>
            <ol className="clean-engine">
              <li className="clean-panel">
                <h3>Ads in an account you own.</h3>
                <p>Your photos, your service area. Every lead is yours.</p>
              </li>
              <li className="clean-panel">
                <h3>A fast text, then a real person.</h3>
                <p>From 8 a.m. to 8 p.m. an assistant asks about the home and how often. Then someone on our team books the first clean in your system.</p>
              </li>
              <li className="clean-panel">
                <h3>Follow-up after the clean.</h3>
                <p>A check-in, a review request, and a win-back if they pause or cancel.</p>
              </li>
            </ol>
            <p className="clean-score">
              Each week: quote requests, first cleans booked, cleans completed, new recurring clients, and win-backs.
            </p>
          </div>
        </section>

        <section className="clean-section">
          <div className="clean-wrap">
            {offerOn ? (
              <>
                <h2>You only pay when a new client goes recurring.</h2>
                <ul className="clean-checks">
                  <li>No setup fee. No monthly fee. {settings.foundingSpotsPerMarket} spots per market.</li>
                  <li>You pay Meta directly, at least {settings.minimumAdBudget}.</li>
                  <li>
                    We earn {cleaningFee()} after their first recurring clean, checked in your booking software.
                  </li>
                  <li>
                    Miss {settings.firstCleans} first cleans within {settings.promiseWindow}? Your next {settings.feeFreeClients} new recurring clients are fee-free.
                  </li>
                </ul>
              </>
            ) : (
              <h2>Pricing is set after your audit.</h2>
            )}
            <Cta />
          </div>
        </section>

        <section className="clean-section">
          <div className="clean-wrap">
            <h2>Who it&apos;s for</h2>
            <div className="clean-fit">
              <article className="clean-panel">
                <h3>Built for you if</h3>
                <ul>
                  <li>You do $15K or more a month, mostly house cleaning</li>
                  <li>Your teams can take more homes</li>
                  <li>You can put {settings.minimumAdBudget} into ads</li>
                  <li>We can book into your software or calendar</li>
                </ul>
              </article>
              <article className="clean-panel clean-not">
                <h3>Not a fit if</h3>
                <ul>
                  <li>You clean alone, or only do commercial work</li>
                  <li>Your schedule is full</li>
                  <li>You compete only on the lowest price</li>
                  <li>You won&apos;t share booking records</li>
                </ul>
              </article>
            </div>
            <p className="clean-score">One residential cleaning company per market. When your area is taken, it&apos;s closed.</p>
          </div>
        </section>

        <section className="clean-section">
          <div className="clean-wrap clean-faq">
            <h2>FAQ</h2>
            {cleaningFaqs().map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="clean-section">
          <div className="clean-wrap">
            <h2>Get your free Lead Leak Audit.</h2>
            <p>{settings.callbackPromise} The call is about five minutes. Before it, we time how fast your company answers a quote request.</p>
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
