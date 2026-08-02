import type { Metadata } from 'next';
import LegalShell from '../components/LegalShell';

export const metadata: Metadata = {
  title: { absolute: 'Terms | Divine Acquisition' },
  description: 'Terms of use for Divine Acquisition.',
  alternates: {
    canonical: 'https://acq.divineacquisition.io/terms',
  },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms">
      <p>
        This page is a placeholder for the Divine Acquisition terms of use. The full terms will be
        published here.
      </p>
      <p>
        By booking a call or using this site, you agree that any engagement is subject to a separate
        written agreement covering scope, performance fees, and responsibilities.
      </p>
      <p>For questions, contact your Divine Acquisition representative.</p>
    </LegalShell>
  );
}
