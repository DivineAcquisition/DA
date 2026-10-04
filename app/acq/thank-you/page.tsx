import { redirect } from 'next/navigation';
import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { FACEBOOK_DISCLAIMER, THANK_YOU } from '@/lib/acq/copy';
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
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />
      <div className="relative z-10">
        <header className="px-5 pt-6 sm:px-6 sm:pt-8">
          <div className="mx-auto flex max-w-3xl justify-center">
            <Logo className="h-[20px] w-auto sm:h-[24px]" title="Divine Acquisition" />
          </div>
        </header>
        <section className="px-5 pb-20 pt-12 sm:px-6 sm:pt-16">
          <div className="mx-auto max-w-3xl">
            <h1 className="acq-headline text-3xl font-semibold tracking-tight sm:text-4xl">{THANK_YOU.title}</h1>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-neutral-300 sm:text-[15px]">
              <p>
                I put real time into the system roadmaps and blueprints for this call. That work only
                pays off if you show up. Please book a time you will keep.
              </p>
              <p>
                We do not actively manage ad campaigns. We assist with offer positioning and messaging
                so it lines up with the system we build.
              </p>
              <p className="text-neutral-400">
                Submit the application once more to open the date and time picker for your 30-minute audit.
              </p>
            </div>
          </div>
        </section>
        <footer className="border-t border-white/[0.06] px-5 py-10 text-center">
          <p className="mx-auto max-w-2xl text-[11px] leading-relaxed text-neutral-600">{FACEBOOK_DISCLAIMER}</p>
        </footer>
      </div>
    </div>
  );
}
