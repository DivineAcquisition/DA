import { redirect } from 'next/navigation';
import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { controlRpc } from '@/lib/ad/rpc';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import { NEUTRAL_UNAVAILABLE_MESSAGE } from '@/lib/workspace/tokens';

export const dynamic = 'force-dynamic';

type ResolvedSigning = {
  destination_url: string;
  recipient_name?: string;
  template_name?: string;
  status?: string;
};

function Unavailable() {
  return (
    <div className="da-workspace relative flex min-h-screen items-center justify-center px-5">
      <Backdrop />
      <div className="relative z-10 max-w-md rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-8 text-center animate-rise">
        <Logo className="mx-auto h-7 w-auto" />
        <p className="mt-6 text-sm leading-relaxed text-[var(--ws-body)]">{NEUTRAL_UNAVAILABLE_MESSAGE}</p>
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

  const supabase = await createClient();
  const { data } = await controlRpc<ResolvedSigning>(supabase, 'da_resolve_signing_token', {
    p_token: token,
  });

  if (!data?.destination_url) return <Unavailable />;

  redirect(data.destination_url);
}
