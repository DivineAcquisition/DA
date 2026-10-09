import { NicheLanding } from '@/app/acq/components/niche/NicheLanding';
import { ROOFING } from '@/lib/acq/niche-content';
import { headlineVariantFromUtm, nicheTrackingFromSearch } from '@/lib/acq/niche-tracking';

export const dynamic = 'force-dynamic';

export default async function RoofingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const tracking = nicheTrackingFromSearch(query);
  const variant = headlineVariantFromUtm(tracking.utm_content);
  return <NicheLanding content={ROOFING} variant={variant} tracking={tracking} />;
}
