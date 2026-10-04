import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';

export default function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />
      <div className="relative z-10">
        <header className="border-b border-white/[0.06]">
          <div className="mx-auto flex h-16 max-w-3xl items-center px-5 sm:h-[72px] sm:px-6">
            <Logo className="h-[22px] w-auto sm:h-[28px]" title="Divine Acquisition" />
          </div>
        </header>

        <main className="px-5 py-14 sm:px-6 sm:py-20">
          <article className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-neutral-400">
              {children}
            </div>
          </article>
        </main>

        <footer className="border-t border-white/[0.06] px-5 py-8 text-center sm:px-6">
          <p className="text-xs text-neutral-600">© Divine Acquisition. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
