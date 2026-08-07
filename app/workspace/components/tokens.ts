/**
 * Shared class strings for the workspace surface — hiring-page visual language.
 *
 * These live outside ui.tsx on purpose. ui.tsx is a client module, and a
 * server component that imports a plain object across that boundary gets a
 * client reference rather than the object, which renders class="undefined".
 */
export const ws = {
  page: 'bg-ink-950 text-white',
  card: 'panel rounded-2xl',
  panelHeader: 'bg-ink-850/80',
  input:
    'w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none transition focus:border-brand-500/60 focus:bg-white/[0.05]',
  label: 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500',
  heading: 'text-white tracking-tight',
};
