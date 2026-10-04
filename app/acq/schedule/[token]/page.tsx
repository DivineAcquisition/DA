import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { FACEBOOK_DISCLAIMER } from '@/lib/acq/copy';
import { loadAcqSchedule } from '@/lib/acq/schedule';
import { AcqScheduler } from '../Scheduler';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: { absolute: 'Book your audit | Divine Acquisition' },
  robots: { index: false, follow: false },
};

export default async function AcqSchedulePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const schedule = await loadAcqSchedule(token);
  const firstName = schedule?.fullName.trim().split(/\s+/)[0] || 'there';

  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />
      <div className="relative z-10">
        <header className="px-5 pt-6 sm:px-6 sm:pt-8">
          <div className="mx-auto flex max-w-3xl justify-center">
            <Logo className="h-5 w-auto sm:h-6" title="Divine Acquisition" />
          </div>
        </header>

        <section className="px-5 pb-20 pt-10 sm:px-6 sm:pt-14">
          <div className="mx-auto max-w-3xl">
            {!schedule ? (
              <div className="text-center">
                <h1 className="acq-headline text-3xl font-semibold">This scheduling link is not available</h1>
                <p className="mt-4 text-sm text-neutral-400">
                  Submit the application again, or reply to the email if you already booked.
                </p>
              </div>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">
                  Application received
                </p>
                <h1 className="acq-headline mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {schedule.scheduledFor ? `You're booked, ${firstName}.` : `Hi ${firstName}. Pick a date and time.`}
                </h1>
                <div className="mt-5 space-y-4 text-sm leading-relaxed text-neutral-300 sm:text-[15px]">
                  <p>
                    I put real time into the system roadmaps and blueprints for this call. That work
                    only pays off if you show up. Please book a time you will keep.
                  </p>
                  <p>
                    We do not actively manage ad campaigns. We assist with offer positioning and
                    messaging so it lines up with the system we build.
                  </p>
                </div>
                <div className="mt-8">
                  <AcqScheduler
                    token={token}
                    booked={
                      schedule.scheduledFor
                        ? {
                            startsAt: schedule.scheduledFor,
                            timeZone: schedule.timeZone || 'America/New_York',
                            meetUrl: schedule.meetUrl,
                          }
                        : null
                    }
                  />
                </div>
              </>
            )}
          </div>
        </section>

        <footer className="border-t border-white/[0.06] px-5 py-10 text-center">
          <p className="mx-auto max-w-2xl text-[11px] leading-relaxed text-neutral-600">
            {FACEBOOK_DISCLAIMER}
          </p>
        </footer>
      </div>
    </div>
  );
}
