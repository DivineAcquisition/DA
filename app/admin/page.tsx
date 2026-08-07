import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAdminClient,
  createClient,
} from "@/lib/supabase/server";
import { getWorkspaceAccess } from "@/lib/workspace/access";
import { StatusBanner } from "./status-banner";

export const dynamic = "force-dynamic";

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export default async function AssessmentAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const access = await getWorkspaceAccess(user.id);
  if (!access.isAdmin) {
    redirect("/acct");
  }

  const admin = createAdminClient();
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : null;
  const message = typeof params.message === "string" ? params.message : null;
  const hdrs = await headers();
  const unified = hdrs.get("x-da-unified-admin") === "1";

  const [
    { data: invites },
    { data: bookings },
    { data: schedules },
  ] = await Promise.all([
    admin
      .from("assessment_invites")
      .select("id, email, full_name, token, status, created_at, expires_at")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("assessment_bookings")
      .select(
        "id, invite_id, start_at, end_at, timezone, status, meeting_url, created_at"
      )
      .order("start_at", { ascending: true })
      .limit(50),
    admin
      .from("assessment_schedules")
      .select(
        "id, weekday, start_time, end_time, timezone, slot_minutes, capacity, is_active"
      )
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true }),
  ]);

  const inviteRows = asArray(invites);
  const bookingRows = asArray(bookings);
  const scheduleRows = asArray(schedules);

  return (
    <div className={unified ? "space-y-8" : "min-h-screen bg-slate-50 text-slate-900"}>
      {!unified ? (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
                Divine Acquisition
              </p>
              <h1 className="text-lg font-semibold">Talent Assessment Admin</h1>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/hiring" className="text-slate-600 hover:text-slate-900">
                Careers
              </Link>
              <Link href="/assessment" className="text-slate-600 hover:text-slate-900">
                Assessment portal
              </Link>
              <form action="/auth/signout" method="post">
                <button className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>
      ) : null}

      <main className={unified ? "space-y-8" : "mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6"}>
        {!unified ? (
          <StatusBanner status={status} message={message} />
        ) : status || message ? (
          <StatusBanner status={status} message={message} />
        ) : null}

        {!unified ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">Invite candidate</h2>
            <p className="mt-1 text-sm text-slate-600">
              Creates a secure assessment invite link and emails the candidate.
            </p>
            <form action="/api/admin/assessment/invites" method="post" className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Full name</span>
                <input
                  name="full_name"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-indigo-500 focus:ring-2"
                  placeholder="Alex Candidate"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-indigo-500 focus:ring-2"
                  placeholder="alex@example.com"
                />
              </label>
              <div className="sm:col-span-2">
                <button className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
                  Send invite
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="panel p-6">
            <h2 className="font-display text-lg font-semibold text-white">Invite candidate</h2>
            <p className="mt-1 text-sm text-ink-300">
              Creates a secure assessment invite link and emails the candidate.
            </p>
            <form action="/api/admin/assessment/invites" method="post" className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-200">Full name</span>
                <input
                  name="full_name"
                  required
                  className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-white outline-none ring-brand-400 focus:ring-2"
                  placeholder="Alex Candidate"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-200">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-white outline-none ring-brand-400 focus:ring-2"
                  placeholder="alex@example.com"
                />
              </label>
              <div className="sm:col-span-2">
                <button className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400">
                  Send invite
                </button>
              </div>
            </form>
          </section>
        )}

        {!unified ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Availability schedule</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Recurring weekly windows used for interview booking.
                </p>
              </div>
            </div>

            <form action="/api/admin/assessment/schedules" method="post" className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Weekday</span>
                <select name="weekday" className="w-full rounded-xl border border-slate-200 px-3 py-2" defaultValue="1">
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Start</span>
                <input name="start_time" type="time" required defaultValue="09:00" className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">End</span>
                <input name="end_time" type="time" required defaultValue="17:00" className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Timezone</span>
                <input name="timezone" required defaultValue="America/New_York" className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Slot (min)</span>
                <input name="slot_minutes" type="number" min={15} step={15} defaultValue={30} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Capacity</span>
                <input name="capacity" type="number" min={1} defaultValue={1} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <div className="sm:col-span-3 lg:col-span-6">
                <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                  Add schedule
                </button>
              </div>
            </form>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Day</th>
                    <th className="py-2 pr-4 font-medium">Window</th>
                    <th className="py-2 pr-4 font-medium">Timezone</th>
                    <th className="py-2 pr-4 font-medium">Slot</th>
                    <th className="py-2 pr-4 font-medium">Capacity</th>
                    <th className="py-2 font-medium">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][row.weekday]}</td>
                      <td className="py-2 pr-4">{row.start_time.slice(0, 5)} – {row.end_time.slice(0, 5)}</td>
                      <td className="py-2 pr-4">{row.timezone}</td>
                      <td className="py-2 pr-4">{row.slot_minutes}m</td>
                      <td className="py-2 pr-4">{row.capacity}</td>
                      <td className="py-2">{row.is_active ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {scheduleRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-slate-500">
                        No schedules yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="panel p-6">
            <h2 className="font-display text-lg font-semibold text-white">Availability schedule</h2>
            <p className="mt-1 text-sm text-ink-300">
              Recurring weekly windows used for interview booking.
            </p>
            <form action="/api/admin/assessment/schedules" method="post" className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-200">Weekday</span>
                <select name="weekday" className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-white" defaultValue="1">
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-200">Start</span>
                <input name="start_time" type="time" required defaultValue="09:00" className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-200">End</span>
                <input name="end_time" type="time" required defaultValue="17:00" className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-200">Timezone</span>
                <input name="timezone" required defaultValue="America/New_York" className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-200">Slot (min)</span>
                <input name="slot_minutes" type="number" min={15} step={15} defaultValue={30} className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-white" />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink-200">Capacity</span>
                <input name="capacity" type="number" min={1} defaultValue={1} className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-white" />
              </label>
              <div className="sm:col-span-3 lg:col-span-6">
                <button className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-400">
                  Add schedule
                </button>
              </div>
            </form>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-ink-200">
                <thead className="border-b border-white/10 text-ink-400">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Day</th>
                    <th className="py-2 pr-4 font-medium">Window</th>
                    <th className="py-2 pr-4 font-medium">Timezone</th>
                    <th className="py-2 pr-4 font-medium">Slot</th>
                    <th className="py-2 pr-4 font-medium">Capacity</th>
                    <th className="py-2 font-medium">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleRows.map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="py-2 pr-4">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][row.weekday]}</td>
                      <td className="py-2 pr-4">{row.start_time.slice(0, 5)} – {row.end_time.slice(0, 5)}</td>
                      <td className="py-2 pr-4">{row.timezone}</td>
                      <td className="py-2 pr-4">{row.slot_minutes}m</td>
                      <td className="py-2 pr-4">{row.capacity}</td>
                      <td className="py-2">{row.is_active ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {scheduleRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-ink-400">
                        No schedules yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!unified ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">Recent invites</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Candidate</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Created</th>
                    <th className="py-2 font-medium">Invite link</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteRows.map((invite) => (
                    <tr key={invite.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">
                        <div className="font-medium">{invite.full_name}</div>
                        <div className="text-slate-500">{invite.email}</div>
                      </td>
                      <td className="py-2 pr-4 capitalize">{invite.status}</td>
                      <td className="py-2 pr-4">{new Date(invite.created_at).toLocaleString()}</td>
                      <td className="py-2">
                        <Link href={`/assessment/invite/${invite.token}`} className="text-indigo-600 hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {inviteRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-slate-500">
                        No invites yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="panel p-6">
            <h2 className="font-display text-lg font-semibold text-white">Recent invites</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-ink-200">
                <thead className="border-b border-white/10 text-ink-400">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Candidate</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Created</th>
                    <th className="py-2 font-medium">Invite link</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteRows.map((invite) => (
                    <tr key={invite.id} className="border-b border-white/5">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-white">{invite.full_name}</div>
                        <div className="text-ink-400">{invite.email}</div>
                      </td>
                      <td className="py-2 pr-4 capitalize">{invite.status}</td>
                      <td className="py-2 pr-4">{new Date(invite.created_at).toLocaleString()}</td>
                      <td className="py-2">
                        <Link href={`/assessment/invite/${invite.token}`} className="text-brand-300 hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {inviteRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-ink-400">
                        No invites yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!unified ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">Bookings</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Start</th>
                    <th className="py-2 pr-4 font-medium">End</th>
                    <th className="py-2 pr-4 font-medium">Timezone</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Meeting</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingRows.map((booking) => (
                    <tr key={booking.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{new Date(booking.start_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">{new Date(booking.end_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">{booking.timezone}</td>
                      <td className="py-2 pr-4 capitalize">{booking.status}</td>
                      <td className="py-2">
                        {booking.meeting_url ? (
                          <a href={booking.meeting_url} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
                            Join
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {bookingRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-slate-500">
                        No bookings yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="panel p-6">
            <h2 className="font-display text-lg font-semibold text-white">Bookings</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-ink-200">
                <thead className="border-b border-white/10 text-ink-400">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Start</th>
                    <th className="py-2 pr-4 font-medium">End</th>
                    <th className="py-2 pr-4 font-medium">Timezone</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Meeting</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingRows.map((booking) => (
                    <tr key={booking.id} className="border-b border-white/5">
                      <td className="py-2 pr-4">{new Date(booking.start_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">{new Date(booking.end_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">{booking.timezone}</td>
                      <td className="py-2 pr-4 capitalize">{booking.status}</td>
                      <td className="py-2">
                        {booking.meeting_url ? (
                          <a href={booking.meeting_url} className="text-brand-300 hover:underline" target="_blank" rel="noreferrer">
                            Join
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {bookingRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-ink-400">
                        No bookings yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
