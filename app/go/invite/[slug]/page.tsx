import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import IclosedEmbed from '@/app/acq/components/IclosedEmbed';
import { ACQ_ICLOSED_TITLE } from '@/lib/acq/config';
import { revenueLeakEmbedUrl } from '@/lib/acq/revenue-leak';
import { REVENUE_LEAK } from '@/lib/acq/revenue-leak-content';
import { FACEBOOK_DISCLAIMER } from '@/lib/go/copy';
import { inviteForSlug } from '@/lib/go/invites';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const invite = inviteForSlug((await params).slug);
  const title = invite
    ? `Book with Malik | ${invite.company}`
    : 'Book with Malik | Divine Acquisition';
  return {
    title: { absolute: title },
    description: invite
      ? `A 30-minute session for ${invite.firstName} at ${invite.company}, on ${invite.constraint.toLowerCase()}.`
      : 'Book a 30-minute session with Malik.',
    robots: { index: false, follow: false },
  };
}

export default async function StrategyInvitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const invite = inviteForSlug((await params).slug);
  if (!invite) notFound();
  const jar = await cookies();
  const calendarSrc = revenueLeakEmbedUrl(REVENUE_LEAK.booking.url, {}, {
    fbp: jar.get('_fbp')?.value,
    fbc: jar.get('_fbc')?.value,
  });

  return (
    <div className="acq-coaches min-h-screen antialiased">
      <section className="lx-hero">
        <div className="go-invite">
          <header className="go-invite-bar">
            <p>Divine Acquisition</p>
            <p>30 minutes with Malik</p>
          </header>

          <div className="go-invite-grid">
            <div>
              <p className="lx-pill">{invite.eyebrow}</p>
              <h1 className="lx-headline">
                {invite.headlineBefore}
                <span className="lx-accent">{invite.headlineAccent}</span>
              </h1>
              <p className="go-invite-lead">{invite.lead}</p>

              <p className="go-invite-kicker">On the call</p>
              <ol className="go-invite-points">
                {invite.cover.map((item, index) => (
                  <li key={item.title}>
                    <span>{index + 1}</span>
                    <div>
                      <h2>{item.title}</h2>
                      <p>{item.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <aside className="go-invite-bring">
                <p>Bring this</p>
                <p>{invite.bring}</p>
              </aside>

              <p className="go-invite-sign">
                Malik Sannie
                <span>Divine Acquisition · Google Meet · {invite.city} time is already selected</span>
              </p>
            </div>

            <div className="go-invite-book" id="book">
              <p className="go-invite-kicker">Pick a time</p>
              <h2>Held for {invite.firstName}</h2>
              <p>{invite.company}. Pick a time and the calendar will confirm the reminder number.</p>
              <IclosedEmbed
                url={calendarSrc}
                title={ACQ_ICLOSED_TITLE}
                contentName="Cleaning strategy session"
                contentCategory="cleaning"
                eventName="Schedule"
                shell={false}
                className="mt-4 max-w-none"
              />
            </div>
          </div>
        </div>
      </section>
      <footer className="lx-foot">
        <p>© Divine Acquisition. All rights reserved.</p>
        <p className="mx-auto mt-4 max-w-2xl">{FACEBOOK_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
