import type { Metadata } from 'next';
import Logo from '@/app/components/Logo';
import { LeakFooter } from '@/app/acq/components/revenue-leak/LeakChrome';
import { VisitCapture } from '@/app/acq/components/niche/NicheExperience';
import { REVENUE_LEAK } from '@/lib/acq/revenue-leak-content';
import { nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';

export const dynamic = 'force-dynamic';

const page = REVENUE_LEAK.notYet;

export const metadata: Metadata = {
  title: { absolute: `${page.title} | Divine Acquisition` },
  description: page.body,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: 'https://acq.divineacquisition.io/leak/not-yet' },
};

export default async function RevenueLeakNotYetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tracking = nicheTrackingFromSearch(await searchParams);

  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <VisitCapture tracking={tracking} />
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6">
          <Logo className="h-5 w-auto" title={REVENUE_LEAK.brand} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="acq-headline text-[1.85rem] font-extrabold leading-[1.12] tracking-tight normal-case sm:text-4xl">
          {page.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-300">{page.body}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {page.resourceUrl ? (
            <a className="acq-button acq-button-full no-underline sm:w-auto" href={page.resourceUrl}>
              {page.resourceLabel}
            </a>
          ) : null}
          {page.listUrl ? (
            <a className="acq-button acq-button-full no-underline sm:w-auto" href={page.listUrl}>
              {page.listLabel}
            </a>
          ) : null}
        </div>
      </main>
      <LeakFooter />
    </div>
  );
}
