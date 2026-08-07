import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { supabaseConfigured } from '@/lib/supabase/server';
import { NEUTRAL_UNAVAILABLE_MESSAGE } from '@/lib/workspace/tokens';
import { loadSigningPage } from '@/lib/workspace/signing';
import SigningForm from './SigningForm';

export const dynamic = 'force-dynamic';

function Unavailable() {
  return (
    <div className="da-workspace relative flex min-h-screen items-center justify-center px-5">
      <Backdrop />
      <div className="relative z-10 max-w-md rounded-2xl border border-white/10 bg-ink-850/70 p-8 text-center animate-rise">
        <Logo className="mx-auto h-7 w-auto" />
        <p className="mt-6 text-sm leading-relaxed text-neutral-300">{NEUTRAL_UNAVAILABLE_MESSAGE}</p>
      </div>
    </div>
  );
}

export default async function PublicSigningTokenRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!supabaseConfigured) return <Unavailable />;

  const page = await loadSigningPage(token);
  if (!page) return <Unavailable />;

  return (
    <div className="da-workspace relative min-h-screen">
      <Backdrop />
      <div className="relative z-10 px-4 py-8 sm:px-6 sm:py-12">
        <header className="mx-auto mb-8 flex max-w-6xl items-center justify-between gap-4">
          <Logo className="h-7 w-auto sm:h-8" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Secure signing
          </span>
        </header>
        <SigningForm
          token={page.token}
          templateName={page.templateName}
          recipientName={page.recipientName}
          fields={page.fields}
          consents={page.consents}
          documents={page.documents}
          completed={page.completed}
          signedDocumentUrl={page.signedDocumentUrl}
        />
      </div>
    </div>
  );
}
