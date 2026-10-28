import type { ReactNode } from 'react';

export const studioLink =
  'inline-flex min-h-11 items-center rounded-full border border-white/12 bg-white/[0.03] px-4 text-sm font-semibold text-white transition hover:border-brand-400/50 hover:bg-white/[0.06]';

export function StudioHeader({
  eyebrow = 'Academy',
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1>
        {lede ? <p className="mt-2 text-sm leading-relaxed text-neutral-400">{lede}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}
