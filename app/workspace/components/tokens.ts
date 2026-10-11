/**
 * Shared class strings for the workspace surface — hiring-page visual language.
 *
 * These live outside ui.tsx on purpose. ui.tsx is a client module, and a
 * server component that imports a plain object across that boundary gets a
 * client reference rather than the object, which renders class="undefined".
 */
export const ws = {
  page: 'bg-background text-card-foreground',
  card: 'relative flex flex-col rounded-2xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.014)_38%,transparent_100%),#0b0a11] text-card-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_64px_-36px_rgba(0,0,0,0.88)]',
  panelHeader: 'bg-ink-850/80',
  input:
    'h-10 w-full rounded-xl border border-white/[0.09] bg-ink-850 px-4 text-sm text-card-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition-shadow placeholder:text-muted-foreground/72 hover:border-white/[0.16] focus-visible:border-brand-500/55 focus-visible:ring-[3px] focus-visible:ring-brand-500/20 sm:h-9',
  select:
    'h-10 w-full cursor-pointer appearance-none rounded-xl border border-white/[0.09] bg-ink-850 px-4 pr-9 text-sm text-card-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition-shadow focus-visible:border-brand-500/55 focus-visible:ring-[3px] focus-visible:ring-brand-500/20 sm:h-9',
  label: 'mb-2 inline-flex items-center gap-2 text-sm font-medium text-card-foreground',
  heading: 'font-heading tracking-tight text-card-foreground',
};
