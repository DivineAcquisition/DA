import Link from 'next/link';
import Logo from './Logo';

type SiteHeaderProps = {
  /** Right-hand slot: primary call to action for the current page. */
  action?: React.ReactNode;
};

export default function SiteHeader({ action }: SiteHeaderProps) {
  return (
    <header className="hairline-glow sticky top-0 z-50 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:h-[72px] sm:px-6">
        <Link
          href="/hiring"
          aria-label="DivineAcquisition careers home"
          className="shrink-0 transition-opacity hover:opacity-80"
        >
          <Logo className="h-[22px] w-auto sm:h-[28px]" />
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">{action}</div>
      </div>
    </header>
  );
}
