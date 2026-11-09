import type { Metadata } from 'next';

import { SALES_OPS, SALES_OPS_PATH, SITE } from '@/lib/site/content';

import { SalesOperationsFull, SitePage } from '../components/sections';

export const metadata: Metadata = {
  title: { absolute: `${SALES_OPS.name} | Divine Acquisition™` },
  description: SALES_OPS.positioningBody,
  alternates: { canonical: `${SITE.origin}${SALES_OPS_PATH}` },
};

/** The core offer in full: what we build, who it serves, and the scope. */
export default function SalesOperationsPage() {
  return (
    <SitePage>
      <SalesOperationsFull standalone />
    </SitePage>
  );
}
