import { redirect } from 'next/navigation';
import { FACEBOOK_DISCLAIMER } from '@/lib/acq/copy';
import { qualificationSchedulePath } from '@/lib/acq/config';
import { headers } from 'next/headers';

export const metadata = {
  title: { absolute: 'Application received | Divine Acquisition' },
  robots: { index: false, follow: false },
};

/** Older submits landed here. A token now continues into the date and time page. */
export default async function AcqThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ token }, headerList] = await Promise.all([searchParams, headers()]);
  if (token && token.length >= 32) {
    redirect(qualificationSchedulePath(headerList.get('host') ?? undefined, token));
  }

  return (
    <div className="acq-coaches min-h-screen antialiased">
      <section className="lx-hero">
        <div className="lx-wrap lx-hero-inner">
          <p className="lx-pill">Application received</p>
          <h1 className="lx-headline">Your Application Is In.</h1>
          <div className="lx-card mt-8 max-w-2xl text-left">
            <p>The date and time picker opens as soon as the application is saved. Submit it once more if you landed here without a calendar.</p>
            <p>Real time goes into the roadmap for this call. That work only pays off if you show up. Book a time you will keep.</p>
            <p>We do not run your ads. We line the follow-up up with the offer you already sell.</p>
            <p>Submit the application once more to open the date and time picker for your 30-minute audit.</p>
          </div>
        </div>
      </section>
      <footer className="lx-foot">
        <p className="mx-auto max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
