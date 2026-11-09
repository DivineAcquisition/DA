import type { Metadata } from 'next';

import { ABOUT, PHILOSOPHY_PATH, SITE } from '@/lib/site/content';

import { PhilosophyFull, SitePage } from '../components/sections';

export const metadata: Metadata = {
  title: { absolute: 'Our Philosophy | Divine Acquisition™' },
  description: ABOUT.lead,
  alternates: { canonical: `${SITE.origin}${PHILOSOPHY_PATH}` },
};

/** The philosophy in full: the central belief, the statement, and the four principles. */
export default function PhilosophyPage() {
  return (
    <SitePage>
      <PhilosophyFull standalone />
    </SitePage>
  );
}
