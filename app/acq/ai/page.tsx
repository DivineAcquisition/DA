import type { Metadata } from 'next';
import { FrontOfficeLanding } from '@/app/acq/components/niche/FrontOfficeLanding';
import { SHARED_FRONT_OFFICE, frontOfficeHeadlineVariant } from '@/lib/acq/front-office-content';
import { rememberFrontOfficeTouch } from '@/lib/acq/front-office-touch';
import { nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: SHARED_FRONT_OFFICE.meta.title },
  description: SHARED_FRONT_OFFICE.meta.description,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: 'https://try.divineacquisition.io/' },
};

function readParam(value: string | string[] | undefined): string {
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() ?? '';
}

export default async function FrontOfficePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const tracking = nicheTrackingFromSearch(query);
  const named = readParam(query.content);
  if (!tracking.utm_content && named) tracking.utm_content = named.slice(0, 300);
  const variant = frontOfficeHeadlineVariant(named, tracking.utm_content);
  await rememberFrontOfficeTouch(tracking);
  return (
    <FrontOfficeLanding content={SHARED_FRONT_OFFICE} variant={variant} tracking={tracking} fallback={false} />
  );
}
