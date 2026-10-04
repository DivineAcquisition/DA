import { redirect } from 'next/navigation';
import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { CallScheduler } from '@/components/schedule/Schedulers';
import { controlRpc } from '@/lib/ad/rpc';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import { NEUTRAL_UNAVAILABLE_MESSAGE } from '@/lib/workspace/tokens';

export const dynamic = 'force-dynamic';

type ResolvedLink = {
  kind?: string;
  destination_url?: string;
  contact_name?: string;
  organization?: string;
  scheduled_for?: string | null;
  time_zone?: string | null;
  meet_url?: string | null;
};

function Unavailable() {
  return (
    <div className="da-workspace relative flex min-h-screen items-center justify-center px-5">
      <Backdrop />
      <div className="relative z-10 max-w-md rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-8 text-center">
        <Logo className="mx-auto h-7 w-auto" />
        <p className="mt-6 text-sm leading-relaxed text-[var(--ws-body)]">{NEUTRAL_UNAVAILABLE_MESSAGE}</p>
      </div>
    </div>
  );
}

function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function PublicCalendarTokenRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!supabaseConfigured) return <Unavailable />;

  const supabase = await createClient();
  const { data } = await controlRpc<ResolvedLink>(supabase, 'da_resolve_calendar_token', {
    p_token: token,
  });

  if (!data) return <Unavailable />;

  const destination = safeHttpUrl(data.destination_url);
  if (data.kind === 'redirect' || (destination && data.kind !== 'call' && data.kind !== 'hs_call')) {
    if (!destination) return <Unavailable />;
    redirect(destination);
  }

  if (data.kind !== 'call' && data.kind !== 'hs_call') return <Unavailable />;

  const firstName = (data.contact_name || '').trim().split(/\s+/)[0] || 'there';

  return (
    <div className="da-workspace relative min-h-screen px-5 py-10">
      <Backdrop />
      <div className="relative z-10 mx-auto max-w-3xl">
        <Logo className="h-6 w-auto" />
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">
          Schedule a call
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Hi {firstName}. Pick a date and time.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
          {data.organization
            ? `This is for ${data.organization}. `
            : ''}
          Weekdays from 9:00 to 4:30. The call is 30 minutes.
        </p>
        <div className="mt-8">
          <CallScheduler
            token={token}
            initialBooking={
              data.scheduled_for
                ? {
                    startsAt: data.scheduled_for,
                    timeZone: data.time_zone || 'America/New_York',
                    meetUrl: data.meet_url,
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
