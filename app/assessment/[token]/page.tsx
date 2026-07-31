import Backdrop from '@/app/components/Backdrop';
import Logo from '@/app/components/Logo';
import { eyebrow, sectionLabel } from '@/app/components/ui';
import { validateAssessmentToken } from '@/lib/assessment/actions';
import BookingCalendar from '../components/BookingCalendar';

export const dynamic = 'force-dynamic';

export default async function AssessmentBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await validateAssessmentToken(token);

  if (!result.ok) {
    return (
      <Shell>
        <section className="px-5 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-xl text-center">
            <p className={eyebrow}>Link unavailable</p>
            <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">
              This booking link cannot be opened
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-neutral-400">
              {result.error}. Assessment links expire 24 hours after they are sent. Ask your Divine
              Acquisition contact for a fresh invite.
            </p>
          </div>
        </section>
      </Shell>
    );
  }

  const { invite } = result;
  const firstName = invite.full_name.trim().split(/\s+/)[0] || 'there';
  const expiresLabel = new Date(invite.expires_at).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <Shell>
      <section className="px-5 pb-10 pt-14 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className={`${eyebrow} animate-rise`}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-400" />
            </span>
            Assessment call
          </p>

          <h1 className="animate-rise delay-1 mt-6 text-[2.1rem] font-semibold leading-[1.08] sm:text-5xl">
            Hi {firstName}.{' '}
            <span className="text-gradient">Book your 20–30 minute assessment.</span>
          </h1>

          <p className="animate-rise delay-2 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-[17px]">
            {invite.company_name
              ? `We will walk through fit for ${invite.company_name}, timeline, and next steps.`
              : 'We will walk through fit, timeline, and next steps for placing operators.'}{' '}
            This personal link expires {expiresLabel}.
          </p>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <p className={sectionLabel}>Choose a time</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Pick a slot that works</h2>
          </div>
          <div className="animate-rise delay-3">
            <BookingCalendar />
          </div>
        </div>
      </section>

      <SiteFooter />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:h-[72px] sm:px-6">
            <Logo className="h-[22px] w-auto sm:h-[28px]" />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
