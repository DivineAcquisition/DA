import { sectionLabel } from '@/app/components/ui';
import ScheduleBookingForm from '@/app/admin/components/ScheduleBookingForm';
import SendInviteForm from '@/app/admin/components/SendInviteForm';
import {
  listAssessmentBookings,
  listAssessmentInvites,
  type AssessmentBookingRow,
  type AssessmentInviteRow,
} from '@/lib/assessment/actions';
import { calendarConfigured } from '@/lib/assessment/calendar';
import { GHL_PIT_TOKEN } from '@/lib/assessment/config';

function inviteStatus(invite: AssessmentInviteRow): { label: string; tone: string } {
  const now = Date.now();
  if (invite.revoked_at) return { label: 'Revoked', tone: 'text-flag-critical' };
  if (invite.used_at) return { label: 'Booked', tone: 'text-flag-good' };
  if (new Date(invite.expires_at).getTime() <= now) {
    return { label: 'Expired', tone: 'text-neutral-500' };
  }
  if (invite.opened_at) return { label: 'Opened', tone: 'text-brand-300' };
  return { label: 'Sent', tone: 'text-neutral-300' };
}

function bookingStatus(booking: AssessmentBookingRow): { label: string; tone: string } {
  if (booking.cancelled_at) return { label: 'Cancelled', tone: 'text-flag-critical' };
  if (new Date(booking.starts_at).getTime() <= Date.now()) {
    return { label: 'Completed / past', tone: 'text-neutral-500' };
  }
  if (booking.reminder_sent_at) return { label: 'Reminder sent', tone: 'text-brand-300' };
  return { label: 'Confirmed', tone: 'text-flag-good' };
}

/**
 * Assessment call booking — lives on the Calendar links page alongside
 * tokenized /c/ recipient redirects so there is one calendar surface.
 */
export default async function AssessmentBookingPanel() {
  const [invites, bookings] = await Promise.all([
    listAssessmentInvites(),
    listAssessmentBookings(),
  ]);
  const calendarReady = calendarConfigured();
  const ghlReady = Boolean(GHL_PIT_TOKEN);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
          Assessment booking
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">Talent assessment calls</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Schedule a call yourself (GHL via PIT + Google Meet), or send a 24-hour self-serve booking
          link. Confirmations and 30-minute reminders go out over email.
        </p>
        <p className="mt-2 text-xs text-neutral-600">
          GHL PIT: {ghlReady ? 'connected' : 'not configured — set GHL_PIT_TOKEN'} · Google Calendar:{' '}
          {calendarReady ? 'connected' : 'not configured — set GOOGLE_CALENDAR_* / Drive SA + subject'}
        </p>
      </div>

      <section>
        <div className="panel rounded-3xl p-5 sm:p-7">
          <p className={sectionLabel}>Schedule a call</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Set date &amp; time</h3>
          <p className="mt-2 text-sm text-neutral-500">
            Creates the appointment in GHL through the talent PIT, adds Google Meet when configured,
            emails confirmation now, and auto-reminds 30 minutes before.
          </p>
          <div className="mt-6">
            <ScheduleBookingForm />
          </div>
        </div>
      </section>

      <section>
        <div className="panel rounded-3xl p-5 sm:p-7">
          <p className={sectionLabel}>Self-serve invite</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Send a 24-hour booking link</h3>
          <div className="mt-6">
            <SendInviteForm />
          </div>
        </div>
      </section>

      <section>
        <p className={sectionLabel}>Scheduled calls</p>
        <h3 className="mt-2 text-lg font-semibold text-white">Upcoming &amp; recent</h3>
        <div className="mt-5 space-y-2.5">
          {bookings.length === 0 ? (
            <div className="panel rounded-2xl px-5 py-10 text-center text-sm text-neutral-500">
              No scheduled calls yet.
            </div>
          ) : (
            bookings.map((booking) => {
              const status = bookingStatus(booking);
              return (
                <article
                  key={booking.id}
                  className="panel flex flex-col gap-2 rounded-2xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{booking.full_name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {booking.email}
                      {booking.company_name ? ` · ${booking.company_name}` : ''}
                      {booking.google_meet_url ? ' · Meet ready' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 text-xs sm:items-end">
                    <span className={status.tone}>{status.label}</span>
                    <span className="tabular-nums text-neutral-600">
                      {new Date(booking.starts_at).toLocaleString('en-US', {
                        timeZone: booking.time_zone,
                      })}{' '}
                      ({booking.duration_minutes}m)
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section>
        <p className={sectionLabel}>Recent link invites</p>
        <h3 className="mt-2 text-lg font-semibold text-white">Last 40 sends</h3>
        <div className="mt-5 space-y-2.5">
          {invites.length === 0 ? (
            <div className="panel rounded-2xl px-5 py-10 text-center text-sm text-neutral-500">
              No invites yet.
            </div>
          ) : (
            invites.map((invite) => {
              const status = inviteStatus(invite);
              return (
                <article
                  key={invite.id}
                  className="panel flex flex-col gap-2 rounded-2xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{invite.full_name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {invite.email}
                      {invite.company_name ? ` · ${invite.company_name}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs">
                    <span className={status.tone}>{status.label}</span>
                    <span className="tabular-nums text-neutral-600">
                      exp {new Date(invite.expires_at).toLocaleString()}
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
