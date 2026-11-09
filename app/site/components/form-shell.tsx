import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { ArrowLeft } from 'lucide-react';

import { shell } from './primitives';

/**
 * The homepage address. On divineacquisition.io the homepage is `/`; on
 * previews and localhost it lives at `/site`, because `/` is another app.
 */
export async function homeHref(): Promise<string> {
  const surface = (await headers()).get('x-vistrial-surface');
  return surface === '/site' ? '/' : '/site';
}

/** Frame for the diagnostic and discovery pages: logo, way home, and the hero's glow. */
export async function FormShell({ children }: { children: ReactNode }) {
  const home = await homeHref();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="da-grid absolute inset-x-0 top-0 h-[900px]" />
        <div className="absolute inset-x-0 top-0 h-[700px] bg-[radial-gradient(45%_55%_at_50%_0%,rgba(90,35,252,0.35)_0%,rgba(90,35,252,0.08)_50%,transparent_80%)]" />
      </div>
      <header className="relative">
        <div className={`${shell} flex h-20 items-center justify-between`}>
          <a href={home} aria-label="Divine Acquisition home" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#9a88fc]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/brand/da-wordmark.png" alt="Divine Acquisition" width={900} height={138} className="h-6 w-auto" />
          </a>
          <a href={home} className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white">
            <ArrowLeft className="size-4" aria-hidden />
            Back to site
          </a>
        </div>
      </header>
      <main className={`${shell} relative pt-8 pb-24 sm:pt-14`}>{children}</main>
    </div>
  );
}
