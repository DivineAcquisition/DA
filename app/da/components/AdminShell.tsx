import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Avatar, Badge } from '@/app/vistrial/components/ui';
import { signOutAction } from '@/lib/da/actions';
import type { SessionContext } from '@/lib/supabase/server';

export default function AdminShell({
  session,
  children,
}: {
  session: SessionContext;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link href="/da" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80">
            <Logo markOnly className="h-6 w-auto" />
            <span className="text-sm font-semibold tracking-tight text-white">
              Vistrial<span className="ml-1.5 font-normal text-neutral-500">Growth</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Badge tone="brand">Admin</Badge>
            <span className="hidden items-center gap-2 sm:flex">
              <Avatar name={session.fullName ?? session.email} size="sm" />
              <span className="max-w-40 truncate text-[13px] text-neutral-300">
                {session.fullName ?? session.email}
              </span>
            </span>
            <form action={signOutAction}>
              <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6">{children}</main>

      <footer className="border-t border-white/[0.06] px-5 py-5 sm:px-6">
        <p className="mx-auto max-w-6xl text-xs text-neutral-600">
          Divine Acquisition internal. Clients and operators have no access to this surface. Evidence files
          live in Google Drive; this application stores references.
        </p>
      </footer>
    </div>
  );
}
