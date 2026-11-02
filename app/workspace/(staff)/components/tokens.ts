/**
 * Shared class strings for the workspace surface — hiring-page visual language.
 *
 * These live outside ui.tsx on purpose. ui.tsx is a client module, and a
 * server component that imports a plain object across that boundary gets a
 * client reference rather than the object, which renders class="undefined".
 */
export const ws = {
  page: 'bg-background text-card-foreground',
  card: 'relative flex flex-col rounded-2xl border border-[color:var(--panel-border)] bg-[linear-gradient(180deg,var(--panel-sheen)_0%,var(--panel-sheen-soft)_38%,transparent_100%),var(--card)] text-[color:var(--strong)] shadow-[var(--panel-shadow)]',
  panelHeader: 'bg-ink-850/80',
  input:
    'h-10 w-full rounded-xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 text-sm text-[color:var(--strong)] shadow-[inset_0_1px_0_var(--field-highlight)] outline-none transition-shadow placeholder:text-muted-foreground/72 hover:border-[color:var(--field-border-hover)] focus-visible:border-brand-500/55 focus-visible:ring-[3px] focus-visible:ring-brand-500/20 sm:h-9',
  select:
    'h-10 w-full cursor-pointer appearance-none rounded-xl border border-[color:var(--field-border)] bg-[var(--field-bg)] px-4 pr-9 text-sm text-[color:var(--strong)] shadow-[inset_0_1px_0_var(--field-highlight)] outline-none transition-shadow hover:border-[color:var(--field-border-hover)] focus-visible:border-brand-500/55 focus-visible:ring-[3px] focus-visible:ring-brand-500/20 sm:h-9',
  label: 'mb-2 inline-flex items-center gap-2 text-sm font-medium text-card-foreground',
  heading: 'font-heading tracking-tight text-card-foreground',
};
