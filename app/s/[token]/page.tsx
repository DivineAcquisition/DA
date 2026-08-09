import { redirect } from 'next/navigation';
import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { NEUTRAL_UNAVAILABLE_MESSAGE } from '@/lib/workspace/tokens';
import { resolveSigningToken } from '@/lib/workspace/resolve-signing';

export const dynamic = 'force-dynamic';

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
  const data = await resolveSigningToken(token);

  if (!data?.destination_url) return <Unavailable />;

  redirect(data.destination_url);
}
