import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { headers } from 'next/headers';
import NotConfigured from '@/app/da/components/NotConfigured';
import { academyPathKind } from '@/lib/academy/paths';
import { loadAcademyShell } from '@/lib/academy/load';
import { academyContentOpen } from '@/lib/academy/types';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import './academy.css';
import Chrome from './components/Chrome';
import SignIn from './components/SignIn';
import { AgreementPending, Invited, LoadError, NoAccess, NoEnrollment, NotFoundScreen, OnHold } from './components/Status';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-academy-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { absolute: 'DA Operator Academy' },
  description: 'Divine Acquisition operator training.',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default async function AcademyLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const kind = academyPathKind(h.get('x-pathname') ?? '');
  const linkExpired = h.get('x-academy-link') === 'expired';

  let body: React.ReactNode;
  if (!supabaseConfigured) {
    body = <NotConfigured />;
  } else {
    const session = await getSessionContext();
    if (!session) {
      body = kind === 'missing' ? (
        <Chrome>
          <NotFoundScreen signedIn={false} />
        </Chrome>
      ) : (
        <SignIn linkExpired={linkExpired} />
      );
    } else {
      const loaded = await loadAcademyShell();
      if (!loaded.ok) {
        body = (
          <Chrome signedIn>
            <LoadError message={loaded.message} />
          </Chrome>
        );
      } else if (!academyContentOpen(loaded.shell.state)) {
        const shell = loaded.shell;
        body = (
          <Chrome signedIn>
            {shell.state === 'agreement_pending' ? <AgreementPending shell={shell} /> : null}
            {shell.state === 'on_hold' ? <OnHold shell={shell} /> : null}
            {shell.state === 'no_access' || shell.state === 'signed_out' ? <NoAccess /> : null}
            {shell.state === 'no_enrollment' ? <NoEnrollment /> : null}
            {shell.state === 'invited' ? <Invited shell={shell} /> : null}
          </Chrome>
        );
      } else if (kind === 'missing') {
        body = (
          <Chrome signedIn>
            <NotFoundScreen signedIn />
          </Chrome>
        );
      } else {
        body = (
          <Chrome nav signedIn>
            {children}
          </Chrome>
        );
      }
    }
  }

  return <div className={`${plusJakarta.variable} academy min-h-dvh text-white antialiased`}>{body}</div>;
}
