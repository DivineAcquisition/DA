/**
 * Shared class strings for the workspace surface.
 *
 * These live outside ui.tsx on purpose. ui.tsx is a client module, and a
 * server component that imports a plain object across that boundary gets a
 * client reference rather than the object, which renders class="undefined".
 */
export const ws = {
  page: 'bg-[var(--ws-page)] text-[var(--ws-body)]',
  card:
    'rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] [background-image:linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0)_55%)] shadow-[0_24px_60px_-40px_rgba(124,77,255,0.9)]',
  panelHeader: 'bg-[var(--ws-panel)]',
  input:
    'w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-page)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--ws-dim)] outline-none transition focus:border-[var(--ws-accent)] focus:ring-1 focus:ring-[var(--ws-accent)]',
  label: 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]',
  heading: 'font-[family-name:var(--font-plus-jakarta)] text-white',
};
