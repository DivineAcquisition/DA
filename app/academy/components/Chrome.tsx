import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { academySignOutAction } from '@/lib/academy/actions';

export default function Chrome({
  children,
  nav = false,
  signedIn = false,
}: {
  children: React.ReactNode;
  nav?: boolean;
  signedIn?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/academy" className="inline-flex min-h-11 items-center">
          <Logo className="h-6 w-auto" />
        </Link>
        {signedIn ? (
          <form action={academySignOutAction}>
            <button type="submit" className="min-h-11 rounded-full px-3 text-sm text-neutral-300 hover:text-white">
              Sign out
            </button>
          </form>
        ) : null}
      </header>
      {nav ? (
        <nav className="flex gap-2 px-4 pb-3 sm:px-6" aria-label="Academy">
          <Link href="/academy" className="inline-flex min-h-11 items-center rounded-full bg-white/[0.06] px-4 text-sm font-semibold text-white">
            Dashboard
          </Link>
          <Link href="/academy/modules" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-[#c3b6fe] hover:bg-white/[0.04]">
            Modules
          </Link>
        </nav>
      ) : null}
      <main className="flex flex-1 flex-col px-4 pb-16 sm:px-6">{children}</main>
    </div>
  );
}
