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
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        <Link href="/academy" className="min-h-11 inline-flex items-center">
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
        <nav className="flex gap-2 px-4 pb-2" aria-label="Academy">
          <Link href="/academy" className="min-h-11 inline-flex items-center rounded-full px-3 text-sm text-white">
            Dashboard
          </Link>
          <Link href="/academy/modules" className="min-h-11 inline-flex items-center rounded-full px-3 text-sm text-[#937DFF]">
            Modules
          </Link>
        </nav>
      ) : null}
      <main className="flex flex-1 flex-col px-4 pb-16">{children}</main>
    </div>
  );
}
