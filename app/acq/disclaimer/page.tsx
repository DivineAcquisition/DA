import type { Metadata } from 'next';
import LegalShell from '../components/LegalShell';

export const metadata: Metadata = {
  title: 'Disclaimer',
  description: 'Disclaimer for Divine Acquisition.',
  alternates: {
    canonical: 'https://acq.divineacquisition.io/disclaimer',
  },
};

export default function DisclaimerPage() {
  return (
    <LegalShell title="Disclaimer">
      <p>
        This page is a placeholder for the Divine Acquisition disclaimer. The full disclaimer will
        be published here.
      </p>
      <p>
        Information on this site describes the structure of the performance pilot offer. Results
        vary by business, market, and execution. Nothing on this site is a guarantee of revenue,
        appointments, or outcomes.
      </p>
      <p>
        This site is not a part of the Facebook website or Facebook Inc. Additionally, this site is
        NOT endorsed by Facebook in any way. FACEBOOK is a trademark of META PLATFORMS, Inc.
      </p>
    </LegalShell>
  );
}
