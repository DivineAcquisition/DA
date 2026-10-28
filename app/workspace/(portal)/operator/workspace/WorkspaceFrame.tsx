import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { hubSignOutAction } from '@/lib/vistrial/authActions';
import { jakarta } from './fonts';

/** Divine Acquisition workspace brand: #6A00FF primary, #937DFF accent. */
export const brand = {
  primaryButton:
    'inline-flex h-10 items-center justify-center rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_#6A00FF] transition-colors hover:bg-[#5a00d9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#937DFF]/60',
  ghostButton:
    'inline-flex h-9 items-center justify-center rounded-xl border border-white/10 px-3 text-sm font-medium text-neutral-200 transition-colors hover:border-[#937DFF]/50 hover:text-white',
  eyebrow: 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[#937DFF]',
  heading: 'font-[family-name:var(--font-jakarta)] font-bold tracking-tight text-white',
};

export default function WorkspaceFrame({ children, banner }: { children: React.ReactNode; banner?: React.ReactNode }) {
  return (
    <div className={`${jakarta.variable} min-h-screen bg-ink-950 font-sans text-white antialiased`}>
      {banner}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(106,0,255,0.22),transparent)]"
      />
      <header className={`sticky z-30 border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl ${banner ? 'top-[52px]' : 'top-0'}`}>
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/workspace/operator/workspace" className="flex items-center gap-2.5">
            <Logo markOnly className="h-5 w-auto" />
            <span className={`${brand.heading} text-[15px]`}>Workspace</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/workspace/operator" className="rounded-lg px-2.5 py-1.5 text-neutral-400 hover:text-white">
              My Day
            </Link>
            <form action={hubSignOutAction}>
              <button type="submit" className={brand.ghostButton}>
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="relative mx-auto max-w-3xl px-4 py-8 sm:py-12">{children}</main>
    </div>
  );
}

/** One access state: a short headline, one or two sentences, an optional action. */
export function StatePanel({
  eyebrow,
  title,
  body,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(147,125,255,0.08),rgba(255,255,255,0.01)_45%,transparent)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-10">
      <p className={brand.eyebrow}>{eyebrow}</p>
      <h1 className={`${brand.heading} mt-3 text-2xl sm:text-3xl`}>{title}</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-300">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
      {children ? <div className="mt-8">{children}</div> : null}
    </section>
  );
}

export function DetailGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <dt className="text-xs font-medium text-neutral-500">{item.label}</dt>
          <dd className="mt-1 text-[15px] font-semibold text-white">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
