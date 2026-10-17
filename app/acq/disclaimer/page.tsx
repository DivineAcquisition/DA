import type { Metadata } from 'next';
import { FACEBOOK_DISCLAIMER } from '@/lib/acq/copy';
import LegalShell from '../components/LegalShell';

export const metadata: Metadata = {
  title: { absolute: 'Disclaimer | Divine Acquisition' },
  description: 'Disclaimer for the Divine Acquisition founding install site.',
  alternates: {
    canonical: 'https://acq.divineacquisition.io/disclaimer',
  },
};

export default function DisclaimerPage() {
  return (
    <LegalShell title="Disclaimer">
      <p>Last updated October 17, 2026.</p>
      <p>
        Information on this site describes the founding install and the free sales audit. Results
        vary by business, market, and execution. Nothing on this site is a guarantee of revenue,
        show rate, appointments, or any other outcome. Examples are not typical.
      </p>
      <p>
        The audit is a conversation about your numbers and a written blueprint of what we see. It is
        not a promise that a particular fix will produce a particular result.
      </p>
      <p>{FACEBOOK_DISCLAIMER}</p>
    </LegalShell>
  );
}
