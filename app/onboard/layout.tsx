import type { Metadata } from 'next';
import Logo from '@/app/components/Logo';

export const metadata: Metadata = {
  title: {
    default: 'Client onboarding | Divine Acquisition',
    template: '%s | Divine Acquisition',
  },
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2.5 px-5">
          <Logo markOnly className="h-6 w-auto" />
          <span className="text-sm font-semibold tracking-tight">Divine Acquisition</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">{children}</main>
    </div>
  );
}
