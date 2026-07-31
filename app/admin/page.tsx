import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { btnSecondary, btnSizeSm, eyebrow, sectionLabel } from '@/app/components/ui';
import {
  assessmentSignOutAction,
  listAssessmentInvites,
  type AssessmentInviteRow,
} from '@/lib/assessment/actions';
import { getSessionContext } from '@/lib/supabase/server';
import SendInviteForm from './components/SendInviteForm';

export const dynamic = 'force-dynamic';

function statusFor(invite: AssessmentInviteRow): { label: string; tone: string } {
  const now = Date.now();
  if (invite.revoked_at) return { label: 'Revoked', tone: 'text-flag-critical' };
  if (invite.used_at) return { label: 'Booked', tone: 'text-flag-good' };
  if (new Date(invite.expires_at).getTime() <= now) {
    return { label: 'Expired', tone: 'text-neutral-500' };
  }
  if (invite.opened_at) return { label: 'Opened', tone: 'text-brand-300' };
  return { label: 'Sent', tone: 'text-neutral-300' };
}

export default async function AssessmentAdminPage() {
  const session = await getSessionContext();
  const invites = await listAssessmentInvites();

  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:h-[72px] sm:px-6">
            <Logo className="h-[22px] w-auto sm:h-[28px]" />
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-neutral-500 sm:inline">{session?.email}</span>
              <form action={assessmentSignOutAction}>
                <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
          <p className={eyebrow}>Talent assessment</p>
          <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">
            Send a <span className="text-gradient">24-hour booking invite</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
            Creates a personal link on talent.divineacquisition.io, emails it with Resend, and upserts
            the contact into the GHL talent acquisition pipeline.
          </p>

          <section className="mt-10">
            <div className="panel rounded-3xl p-5 sm:p-7">
              <p className={sectionLabel}>New invite</p>
              <h2 className="mt-2 text-xl font-semibold">Request a 20–30 min assessment call</h2>
              <div className="mt-6">
                <SendInviteForm />
              </div>
            </div>
          </section>

          <section className="mt-10">
            <p className={sectionLabel}>Recent invites</p>
            <h2 className="mt-2 text-xl font-semibold">Last 40 sends</h2>

            <div className="mt-5 space-y-2.5">
              {invites.length === 0 ? (
                <div className="panel rounded-2xl px-5 py-10 text-center text-sm text-neutral-500">
                  No invites yet.
                </div>
              ) : (
                invites.map((invite) => {
                  const status = statusFor(invite);
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
        </main>
      </div>
    </div>
  );
}
