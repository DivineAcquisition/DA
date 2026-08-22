import type { Metadata } from 'next';
import LegalShell from '../components/LegalShell';

export const metadata: Metadata = {
  title: { absolute: 'Privacy Policy | Divine Acquisition' },
  description: 'Privacy policy for Divine Acquisition.',
  alternates: {
    canonical: 'https://acq.divineacquisition.io/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This page is a placeholder for the Divine Acquisition privacy policy. The full policy will
        be published here.
      </p>
      <p>
        When you submit an application, we collect the information you provide (such as name, email,
        phone, company, and qualification answers) so we can review fit and follow up. Ad tracking
        parameters may be associated with your inquiry so we can attribute the campaign that
        produced it.
      </p>
      <p>
        We do not sell your personal information. For privacy requests, contact your Divine
        Acquisition representative.
      </p>
    </LegalShell>
  );
}
