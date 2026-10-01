/**
 * Shared class strings for the workspace surface — hiring-page visual language.
 *
 * These live outside ui.tsx on purpose. ui.tsx is a client module, and a
 * server component that imports a plain object across that boundary gets a
 * client reference rather than the object, which renders class="undefined".
 */
export const ws = {
  page: 'bg-ink-950 text-white',
  card: 'panel relative rounded-2xl',
  panelHeader: 'bg-ink-850/80',
  input:
    'field-control w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600',
  select:
    'field-control w-full cursor-pointer appearance-none rounded-xl px-3.5 py-2.5 pr-9 text-sm text-white',
  label: 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500',
  heading: 'text-white tracking-tight',
};
