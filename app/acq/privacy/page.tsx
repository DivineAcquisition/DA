import type { Metadata } from 'next';
import LegalShell from '../components/LegalShell';

export const metadata: Metadata = {
  title: { absolute: 'Privacy Policy | Divine Acquisition' },
  description: 'Privacy policy for the Divine Acquisition application and free sales audit.',
  alternates: {
    canonical: 'https://acq.divineacquisition.io/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>Last updated October 17, 2026.</p>
      <p>
        Divine Acquisition LLC, 7404 Executive Place, Lanham, MD 20706, operates this site. Questions
        about this policy go to malik@divineacquisition.io.
      </p>
      <p>
        When you submit the application, we collect the first name, email, phone number, and answers
        you type: monthly ad spend, offer price, who takes your sales calls, and the biggest problem
        right now. We use that to review fit and to contact you about the free sales audit you
        requested.
      </p>
      <p>
        Text messages are separate. We send appointment reminders only if you check the box. We store
        whether you checked it, the sentence you agreed to, the time, and the page. You can withdraw
        that consent by replying STOP. Reply HELP for help. Consent is not required to apply.
      </p>
      <p>
        We may call and email you about the audit you requested. You can unsubscribe from email at
        any time. We do not require a text opt-in before we call or email about that request.
      </p>
      <p>
        If you arrive from an ad, we store the campaign parameters on the link, such as source,
        campaign, and ad name, so we know which ad brought you here. The page may set a cookie so
        you can resume an application you already started. We also record that the form was opened,
        along with the time.
      </p>
      <p>
        We share this information with the providers that host the site, store the application, send
        email, place the calendar booking, and run the customer record. If you came from a Meta ad,
        Meta may receive technical data about the visit so we can measure the ad. We do not sell
        your personal information for money.
      </p>
      <p>
        We keep the application while we are reviewing it or working with you, and we keep the text
        consent record for as long as we need it to show what you agreed to. Email
        malik@divineacquisition.io if you want a copy of what we have, or if you want us to correct
        or delete it.
      </p>
      <p>This site is meant for business owners. We do not knowingly collect information from anyone under 18.</p>
    </LegalShell>
  );
}
