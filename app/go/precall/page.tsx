import type { Metadata } from 'next';
import { GO_PRECALL_MEDIA_ID } from '@/lib/go/config';
import { FACEBOOK_DISCLAIMER, PRECALL } from '@/lib/go/copy';
import { GoWistia } from '../components/GoWistia';

export const metadata: Metadata = {
  title: { absolute: 'Your strategy session is confirmed | Divine Acquisition' },
  description: PRECALL.body,
  alternates: { canonical: 'https://go.divineacquisition.io/precall' },
  robots: { index: false, follow: false },
};

export default function GoPrecallPage() {
  return (
    <div className="acq-coaches min-h-screen antialiased">
      <section className="lx-hero">
        <div className="lx-wrap lx-hero-inner">
          <p className="lx-pill">{PRECALL.eyebrow}</p>
          <h1 className="lx-headline">
            {PRECALL.titleBefore}
            <span className="lx-accent">{PRECALL.titleAccent}</span>
          </h1>
          <p className="lx-lead">{PRECALL.body}</p>
          <div className="lx-video-wrap">
            <div className="lx-video-shell">
              <GoWistia mediaId={GO_PRECALL_MEDIA_ID} />
            </div>
          </div>
        </div>
      </section>

      <section className="lx-section">
        <div className="lx-wrap">
          <h2 className="lx-heading">{PRECALL.stepsTitle}</h2>
          <p className="lx-intro">{PRECALL.stepsBody}</p>
          <ol className="lx-steps">
            {PRECALL.steps.map((step, index) => (
              <li key={step.label} className="lx-card">
                <span className="lx-num">{String(index + 1).padStart(2, '0')}</span>
                <h3>{step.label}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <p className="lx-callout">
            <strong>{PRECALL.bonus}</strong>
          </p>
        </div>
      </section>

      <footer className="lx-foot">
        <p>© {new Date().getFullYear()} Divine Acquisition. All rights reserved.</p>
        <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
