/**
 * Shared class recipes. #9A88FC (brand-500) is the prime action colour; it is
 * light enough that near-black label text reads far better on it than white,
 * which is why primary buttons invert their type.
 */

export const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50';

export const btnPrimary = `${btnBase} bg-brand-500 text-ink-950 shadow-[0_12px_34px_-14px_rgba(154,136,252,0.9)] hover:bg-brand-400 hover:shadow-[0_16px_40px_-14px_rgba(154,136,252,1)] active:bg-brand-600 active:text-white`;

/** Reserved for the one conversion action on a page — not for nav or utilities. */
export const btnConvert = `${btnBase} bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 text-ink-950 shadow-[0_14px_36px_-14px_rgba(154,136,252,0.95)] hover:from-brand-300 hover:via-brand-400 hover:to-brand-500 hover:shadow-[0_18px_42px_-14px_rgba(154,136,252,1)] active:from-brand-600 active:via-brand-600 active:to-brand-700 active:text-white`;

export const btnSecondary = `${btnBase} border border-white/[0.12] bg-white/[0.03] text-white hover:border-white/25 hover:bg-white/[0.07]`;

export const btnGhost = `${btnBase} text-neutral-300 hover:text-white`;

export const btnSizeSm = 'px-4 py-2 text-[13px]';
export const btnSizeMd = 'px-5 py-2.5';
export const btnSizeLg = 'px-7 py-3.5 text-[15px]';

export const eyebrow =
  'inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/[0.08] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300';

export const sectionLabel =
  'text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300';
