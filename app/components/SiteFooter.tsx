import Link from 'next/link';
import Logo from './Logo';

const social = [
  { label: 'Instagram', href: 'https://instagram.com/@maliksannie' },
  { label: 'Twitter', href: 'https://x.com/@maliksannie' },
  { label: 'Privacy', href: 'https://divineacquisition.io/privacy-policy' },
];

export default function SiteFooter() {
  return (
    <footer className="hairline-glow relative border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/hiring" aria-label="DivineAcquisition careers home">
              <Logo markOnly className="h-7 w-auto opacity-80 transition-opacity hover:opacity-100" />
            </Link>
            <div>
              <p className="text-sm font-medium text-white">DivineAcquisition™</p>
              <p className="text-xs text-neutral-500">
                Acquisition, retention &amp; AI growth infrastructure.
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {social.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-neutral-400 transition-colors hover:text-brand-300"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <p className="mt-8 border-t border-white/[0.05] pt-6 text-xs text-neutral-600">
          2025 © DivineAcquisition™. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
