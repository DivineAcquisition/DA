import { FACEBOOK_DISCLAIMER } from '@/lib/acq/copy';
import { ROOFING } from '@/lib/acq/niche-content';
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
  const roofing = schedule?.offer === ROOFING.offerLabel;

  return (
    <div className="acq-coaches acq-schedule min-h-screen antialiased">
      <section className="lx-hero">
        <div className="lx-wrap lx-hero-inner">
          {!schedule ? (
            <>
              <p className="lx-pill">Scheduling</p>
              <h1 className="lx-headline">This Scheduling Link Is Not Available</h1>
              <p className="lx-lead">Submit the application again, or reply to the email if you already booked.</p>
            </>
          ) : (
            <>
              <p className="lx-pill">Application received</p>
              <h1 className="lx-headline">
                {schedule.scheduledFor ? `You're Booked, ${firstName}.` : `Hi ${firstName}. Pick A Date And Time.`}
              </h1>
              <p className="lx-lead">
                {roofing
                  ? ROOFING.bookingLead
                  : 'Real time goes into the roadmap for this call. Book a time you will keep. We do not run your ads. We line the follow-up up with the offer you already sell.'}
              </p>
              <div className="mt-8 w-full max-w-3xl text-left">
                <AcqScheduler
                  token={token}
                  trackBooking={roofing}
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
      <footer className="lx-foot">
        <p className="mx-auto max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
