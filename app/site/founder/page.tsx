import type { Metadata } from 'next';

import { FOUNDER, FOUNDER_PATH, SITE } from '@/lib/site/content';

import { FounderFull, SitePage } from '../components/sections';

export const metadata: Metadata = {
  title: { absolute: `${FOUNDER.name}, Founder | Divine Acquisition™` },
  description: FOUNDER.paragraphs[0],
  alternates: { canonical: `${SITE.origin}${FOUNDER_PATH}` },
};

/** The founder's letter in full. */
export default function FounderPage() {
  return (
    <SitePage>
      <FounderFull standalone />
    </SitePage>
  );
}
