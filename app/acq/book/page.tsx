import { redirect } from 'next/navigation';
import {
  acqApplyUrl,
  trackingFromSearchParams,
  type SearchParams,
} from '@/lib/acq/config';

export const metadata = {
  title: { absolute: 'Free Sales Audit | Divine Acquisition' },
  robots: { index: false, follow: false },
};

/** Leftover /book links go to the same Typeform as the landing CTA. */
export default async function AcqBookPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  redirect(acqApplyUrl(trackingFromSearchParams(query)));
}
