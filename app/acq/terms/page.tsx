import type { Metadata } from 'next';
import LegalShell from '../components/LegalShell';

export const metadata: Metadata = {
  title: { absolute: 'Terms | Divine Acquisition' },
  description: 'Terms for the Divine Acquisition application and free sales audit.',
  alternates: {
    canonical: 'https://acq.divineacquisition.io/terms',
  },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms">
      <p>Last updated October 17, 2026.</p>
      <p>
        These terms cover use of this site and the application run by Divine Acquisition LLC.
        Questions go to malik@divineacquisition.io.
      </p>
      <p>
        Submitting the form requests a free sales audit. It is not a purchase, and it does not start
        a client agreement. If we work together after the audit, that work is covered by a separate
        written agreement. The prices and the 75% back offer described on the site apply only if you
        become a client under that agreement.
      </p>
      <p>
        You agree that the name, email, phone, and answers you submit are yours and are accurate
        enough for us to reach you about the audit.
      </p>
      <p>
        Appointment reminder texts are optional. They are sent only if you check the box, only about
        the audit you requested, and only on the terms written next to that box. You can stop them
        by replying STOP. Reply HELP for help. Checking the box is not required to apply or to buy
        anything.
      </p>
      <p>
        We may call and email you about the audit you requested. You can unsubscribe from email at
        any time.
      </p>
      <p>
        Nothing on this site guarantees revenue, show rate, appointments, or any other result.
        Results vary by business, market, and execution.
      </p>
    </LegalShell>
  );
}
