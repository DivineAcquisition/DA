import type { Metadata } from 'next';
import { FrontOfficeLanding } from '@/app/acq/components/niche/FrontOfficeLanding';
import { frontOfficeHeadlineVariant, resolveFrontOffice } from '@/lib/acq/front-office-content';
import { rememberFrontOfficeTouch } from '@/lib/acq/front-office-touch';
import { nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';

export const dynamic = 'force-dynamic';

function readParam(value: string | string[] | undefined): string {
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() ?? '';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ niche: string }>;
}): Promise<Metadata> {
  const { niche } = await params;
  const resolved = resolveFrontOffice(niche);
  const canonical = resolved.fallback
    ? 'https://acq.divineacquisition.io/ai'
    : `https://acq.divineacquisition.io/ai/${resolved.content.id}`;
  return {
    title: { absolute: resolved.content.meta.title },
    description: resolved.content.meta.description,
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    alternates: { canonical },
  };
}

export default async function FrontOfficeNichePage({
  params,
  searchParams,
}: {
  params: Promise<{ niche: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { niche } = await params;
  const query = await searchParams;
  const tracking = nicheTrackingFromSearch(query);
  const named = readParam(query.content);
  if (!tracking.utm_content && named) tracking.utm_content = named.slice(0, 300);
  const variant = frontOfficeHeadlineVariant(named, tracking.utm_content);
  await rememberFrontOfficeTouch(tracking);
  const resolved = resolveFrontOffice(niche);
  return (
    <FrontOfficeLanding content={resolved.content} variant={variant} tracking={tracking} fallback={resolved.fallback} />
  );
}
