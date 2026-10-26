import type { Metadata } from 'next';
import { LeakLanding } from '@/app/acq/components/revenue-leak/LeakLanding';
import { REVENUE_LEAK } from '@/lib/acq/revenue-leak-content';
import { nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';

export const dynamic = 'force-dynamic';

const page = REVENUE_LEAK;

export const metadata: Metadata = {
  title: { absolute: `${page.seo.title} | Divine Acquisition` },
  description: page.seo.description,
  alternates: { canonical: page.seo.canonical },
  robots: page.noindex
    ? { index: false, follow: false, googleBot: { index: false, follow: false } }
    : { index: true, follow: true },
  openGraph: {
    title: `${page.seo.title} | Divine Acquisition`,
    description: page.seo.description,
    url: page.seo.canonical,
    siteName: 'Divine Acquisition',
    images: [{ url: page.seo.shareImage, alt: page.seo.shareImageAlt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${page.seo.title} | Divine Acquisition`,
    description: page.seo.description,
    images: [page.seo.shareImage],
  },
};

export default async function RevenueLeakPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tracking = nicheTrackingFromSearch(await searchParams);
  return <LeakLanding tracking={tracking} />;
}
