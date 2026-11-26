import { headers } from 'next/headers';
import { ArrowLeft } from 'lucide-react';

import { shell } from '@/app/site/components/primitives';
import { FACEBOOK_DISCLAIMER, LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '@/lib/acq/copy';
import { roofingApplyPath, roofingLandingPath } from '@/lib/acq/niche-lead';
import { withNicheTracking, type NicheVisit } from '@/lib/acq/niche-tracking';

/** Landing and form addresses for this host, carrying the ad's tracking forward. */
export async function roofingPaths(tracking: NicheVisit) {
  const host = (await headers()).get('host');
  return {
    landing: withNicheTracking(roofingLandingPath(host), tracking),
    apply: withNicheTracking(roofingApplyPath(host), tracking),
  };
}

function Wordmark({ className }: { className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/site/brand/da-wordmark.png" alt="Divine Acquisition" width={900} height={138} className={className} />
  );
}

export function RoofingNav({ home, cta }: { home: string; cta?: { href: string; label: string } }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between rounded-2xl border border-[#9a88fc]/15 bg-[#12101a]/80 pr-2 pl-4 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:pl-5">
        <a href={home} aria-label="Divine Acquisition" className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#9a88fc]">
          <Wordmark className="h-[22px] w-auto sm:h-6" />
        </a>
        {cta ? (
          <a href={cta.href} className="da-btn-primary inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-white">
            <span className="relative z-[1]">{cta.label}</span>
          </a>
        ) : null}
      </div>
    </header>
  );
}

/** Header for the form and follow-up pages: logo and a way back to the landing page. */
export function RoofingFormHeader({ home, back }: { home: string; back: string }) {
  return (
    <header className="relative">
      <div className={`${shell} flex h-20 items-center justify-between`}>
        <a href={home} aria-label="Divine Acquisition" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#9a88fc]">
          <Wordmark className="h-6 w-auto" />
        </a>
        <a href={home} className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white">
          <ArrowLeft className="size-4" aria-hidden />
          {back}
        </a>
      </div>
    </header>
  );
}

export function RoofingBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="da-grid absolute inset-x-0 top-0 h-[900px]" />
      <div className="absolute inset-x-0 top-0 h-[700px] bg-[radial-gradient(45%_55%_at_50%_0%,rgba(90,35,252,0.35)_0%,rgba(90,35,252,0.08)_50%,transparent_80%)]" />
    </div>
  );
}

export function RoofingFooter({ links, children }: { links?: { href: string; label: string }[]; children?: React.ReactNode }) {
  return (
    <footer className="relative border-t border-[#9a88fc]/15 bg-[#09080e]">
      <div className={`${shell} py-16`}>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Wordmark className="h-7 w-auto" />
            <p className="da-mono mt-5 text-[11px] tracking-[0.16em] text-white/45 uppercase">Reply · Follow up · Book the inspection</p>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
            {(links ?? []).map((link) => (
              <li key={link.label}>
                <a href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a href={LEGAL_TERMS_URL} className="transition-colors hover:text-white">
                Terms
              </a>
            </li>
            <li>
              <a href={LEGAL_PRIVACY_URL} className="transition-colors hover:text-white">
                Privacy
              </a>
            </li>
          </ul>
        </div>
        {children}
        <div className="mt-14 space-y-3 border-t border-[#9a88fc]/15 pt-6 text-xs leading-relaxed text-white/35">
          <p>© {new Date().getFullYear()} Divine Acquisition. All rights reserved.</p>
          <p className="max-w-3xl">{FACEBOOK_DISCLAIMER}</p>
        </div>
      </div>
    </footer>
  );
}
