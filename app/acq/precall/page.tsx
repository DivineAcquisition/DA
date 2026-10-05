import { ACQ_PRECALL_WISTIA_MEDIA_ID } from '@/lib/acq/config';
import { FACEBOOK_DISCLAIMER, PRECALL } from '@/lib/acq/copy';
import HeroVideo from '../components/HeroVideo';

export const metadata = {
  title: { absolute: 'Your audit is confirmed | Divine Acquisition' },
  description: PRECALL.body,
  alternates: {
    canonical: 'https://acq.divineacquisition.io/precall',
  },
  robots: { index: false, follow: false },
};

export default function AcqPrecallPage() {
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
          <HeroVideo shell mediaId={ACQ_PRECALL_WISTIA_MEDIA_ID} contentName="Precall Audit Briefing" />
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
        </div>
      </section>
      <footer className="lx-foot">
        <p>© Divine Acquisition. All rights reserved.</p>
        <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
