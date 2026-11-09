'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ChevronRight,
  FolderClosed,
  FolderOpen,
  ChevronsUpDown,
  CornerDownLeft,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  CircleHelp,
  X,
} from 'lucide-react';
import Logo from '@/app/components/Logo';
import { SectionTabs } from '@/app/workspace/components/SectionTabs';
import { ThemeToggle } from '@/app/workspace/components/ThemeControls';
import { StatusPill } from '@/app/workspace/components/VistrialChrome';
import { BorderBeam } from '@/components/ui/border-beam';
import { Kbd } from '@/components/ui/kbd';
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuLinkItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { signOutAction } from '@/lib/workspace/actions';
import { cn } from '@/lib/utils';
import {
  buildNav,
  findActive,
  railRows,
  searchNav,
  type ActiveMatch,
  type NavCounts,
  type NavIcon,
  type NavItem,
  type NavSection,
  type NavTone,
} from '@/lib/workspace/adminNav';
import { interDisplay } from './fonts';
import { LiveDot } from './agentic';
import '@/components/agentic/agentic.css';

const COLLAPSE_KEY = 'da-admin-sidebar-collapsed';
const COLLAPSE_EVENT = 'da-admin-sidebar-toggle';
const SEARCH_ID = 'da-admin-nav-search';

// A per-person convenience only: the page renders correctly without it.
function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    /* storage can be blocked: the sidebar then simply does not remember */
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

function initials(email: string) {
  const name = email.split('@')[0] ?? '';
  const parts = name.split(/[._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function IconTile({ icon: Glyph, active, size = 'md' }: { icon: NavIcon; tone?: NavTone; active: boolean; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border',
        size === 'lg' ? 'size-9' : 'size-8',
        active
          ? 'border-[#6650d8]/30 bg-gradient-to-b from-[#d9d1fe] to-[#9a88fc] text-[#07070b] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
          : 'border-white/10 bg-white/[0.05] text-neutral-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] group-hover/row:border-brand-300/40 group-hover/row:text-white',
      )}
    >
      <Glyph className={size === 'lg' ? 'size-4' : 'size-3.5'} strokeWidth={1.9} aria-hidden />
    </span>
  );
}

type NavigateHandler = (href: string) => void;

/** Spring-animated highlight shared by every row, so it glides to the new page. */
function ActiveGlow({ layoutId }: { layoutId: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 520, damping: 42 }}
      className="absolute inset-0 -z-10 rounded-xl border border-[#9A88FC]/40 bg-[linear-gradient(180deg,rgba(154,136,252,0.28),rgba(154,136,252,0.08))] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_28px_-16px_rgba(106,0,255,0.85)]"
      aria-hidden
    />
  );
}

function CollapsedItem({
  section,
  item,
  active,
  onNavigate,
  glowId,
  marked = false,
}: {
  section: NavSection;
  item: NavItem;
  active: ActiveMatch | null;
  onNavigate: NavigateHandler;
  glowId: string;
  marked?: boolean;
}) {
  const containsActive = marked || active?.item === item;
  const children = item.children ?? [];
  const tileClass =
    'group/row relative isolate flex size-10 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60';

  if (!children.length) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href={item.href}
                prefetch
                onClick={() => onNavigate(item.href)}
                aria-current={containsActive ? 'page' : undefined}
                className={tileClass}
              />
            }
          >
            {containsActive ? <ActiveGlow layoutId={glowId} /> : null}
            <IconTile icon={item.icon} tone={section.tone} active={containsActive} size="lg" />
            {item.badge ? (
              <span className="absolute right-1 top-1 size-2 rounded-full da-primary" aria-hidden />
            ) : null}
            <span className="sr-only">{item.badge ? `${item.label}, ${item.badge}` : item.label}</span>
          </TooltipTrigger>
          <TooltipPopup side="right" sideOffset={10} className="font-medium">
            {item.label}
          </TooltipPopup>
        </Tooltip>
      </li>
    );
  }

  // With the labels hidden, a parent opens a flyout listing its pages.
  return (
    <li>
      <Menu>
        <MenuTrigger openOnHover delay={80} aria-label={item.label} className={tileClass}>
          {containsActive ? <ActiveGlow layoutId={glowId} /> : null}
          <IconTile icon={item.icon} tone={section.tone} active={containsActive} size="lg" />
        </MenuTrigger>
        <MenuPopup side="right" align="start" sideOffset={10} className="w-56">
          <MenuGroup>
            <MenuGroupLabel className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-brand-400" aria-hidden />
              {section.heading}
            </MenuGroupLabel>
            {[item, ...children].map((leaf) => {
              const Glyph = leaf.icon;
              const current = leaf === item ? containsActive && !active?.child : active?.child === leaf;
              return (
                <MenuLinkItem
                  key={leaf.href}
                  render={<Link href={leaf.href} prefetch onClick={() => onNavigate(leaf.href)} />}
                  className={cn(current && 'bg-accent text-accent-foreground')}
                >
                  <Glyph className={cn(current && 'text-brand-200')} strokeWidth={1.9} aria-hidden />
                  {leaf.label}
                </MenuLinkItem>
              );
            })}
          </MenuGroup>
        </MenuPopup>
      </Menu>
    </li>
  );
}

const FOLDER_STORE = 'da.admin.folders.v1';
const DESK_IDS = new Set(['operators', 'clients', 'placements', 'review']);

function readFolders(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(FOLDER_STORE);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function writeFolders(open: Set<string>) {
  try {
    window.localStorage.setItem(FOLDER_STORE, JSON.stringify([...open]));
  } catch {
    /* blocked storage: folders still work, they are just not remembered */
  }
}

function sectionCount(section: NavSection) {
  return section.items.reduce((sum, item) => sum + (item.badge ?? 0), 0);
}

function Count({ value }: { value: number }) {
  if (!value) return null;
  return <span className="ml-auto shrink-0 rounded-full bg-brand-500/15 px-1.5 text-[11px] leading-5 tabular-nums text-brand-200">{value}</span>;
}

const folderRow =
  'flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-400/60';

/**
 * The workspace as folders, after the Vistrial app: each desk is a folder
 * holding its queues, with a live count and a state dot. A ringing dot means
 * something there waits on a person. System is one folder, closed by default.
 * Opened folders are remembered in this browser only.
 */
function FolderTree({ nav, active, onNavigate }: { nav: NavSection[]; active: ActiveMatch | null; onNavigate: NavigateHandler }) {
  // The server has no storage, so both renders start from the default and the
  // saved folders are restored after mount.
  const [open, setOpen] = useState<Set<string>>(() => new Set(['operators', 'review']));
  useEffect(() => {
    const saved = readFolders();
    if (!saved) return;
    const timer = window.setTimeout(() => setOpen(saved), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeFolders(next);
      return next;
    });

  const desks = nav.filter((section) => DESK_IDS.has(section.id));
  const rest = nav.filter((section) => !DESK_IDS.has(section.id));

  const branch = (section: NavSection) => {
    const here = active?.section.id === section.id;
    const isOpen = open.has(section.id) || here;
    const count = sectionCount(section);
    const href = railRows(section)[0]?.href ?? section.items[0]?.href ?? '/workspace';
    const desk = DESK_IDS.has(section.id);
    return (
      <li key={section.id} role="treeitem" aria-expanded={isOpen} aria-selected={here && !active?.child && active?.item.href === href}>
        <div className={cn('group/row flex min-w-0 items-center rounded-lg', here && 'bg-brand-500/[0.08]')}>
          <button
            type="button"
            aria-label={isOpen ? `Close ${section.heading}` : `Open ${section.heading}`}
            onClick={() => toggle(section.id)}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:text-white"
          >
            <ChevronRight aria-hidden className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')} />
          </button>
          <Link
            href={href}
            prefetch
            onClick={() => onNavigate(href)}
            className={cn(folderRow, 'flex-1 pl-1', here ? 'font-medium text-white' : 'text-neutral-300 hover:bg-white/[0.04] hover:text-white')}
          >
            {isOpen ? <FolderOpen aria-hidden className={cn('size-4 shrink-0', here ? 'text-brand-300' : 'text-neutral-500')} /> : <FolderClosed aria-hidden className="size-4 shrink-0 text-neutral-500" />}
            <span className="truncate">{section.heading}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              <Count value={count} />
              {desk ? <LiveDot tone={count > 0 ? 'waiting' : 'clear'} label={count > 0 ? `${count} waiting on a person` : 'Clear'} /> : null}
            </span>
          </Link>
        </div>
        {isOpen ? (
          <ul role="group" className="ml-[11px] mt-0.5 grid gap-0.5 border-l border-white/[0.07] pl-2">
            {section.items.map((item) => {
              const current = active?.item === item;
              const Glyph = item.icon;
              return (
                <li key={item.href} role="treeitem" aria-selected={current}>
                  <Link
                    href={item.href}
                    prefetch
                    onClick={() => onNavigate(item.href)}
                    aria-current={current ? 'page' : undefined}
                    className={cn(folderRow, 'text-[13px]', current ? 'bg-brand-500/15 text-brand-200' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white')}
                  >
                    <Glyph aria-hidden className={cn('size-3.5 shrink-0', current ? 'text-brand-200' : 'opacity-70')} strokeWidth={1.9} />
                    <span className="truncate">{item.label}</span>
                    {item.badge ? <Count value={item.badge} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="grid gap-5">
      {desks.length ? (
        <div className="grid gap-1.5">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Desks</p>
          <ul role="tree" aria-label="Desks" className="grid gap-0.5">
            {desks.map(branch)}
          </ul>
        </div>
      ) : null}
      {rest.length ? (
        <div className={cn('grid gap-1.5', desks.length && 'border-t border-white/[0.06] pt-4')}>
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Workspace</p>
          <ul role="tree" aria-label="Workspace" className="grid gap-0.5">
            {rest.map(branch)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type Waiting = { key: string; label: string; desk: string; count: number; href: string };

function waitingOn(nav: NavSection[]): Waiting[] {
  return nav
    .flatMap((section) =>
      section.items.filter((item) => item.badge).map((item) => ({ key: `${section.id}-${item.href}`, label: item.label, desk: section.heading, count: item.badge ?? 0, href: item.href })),
    )
    .sort((a, b) => b.count - a.count);
}

const FLOW_STEPS = [
  { label: 'Application', href: '/workspace/operators/applicants', hint: 'Read, then advance or decline.' },
  { label: 'Case file', href: '/workspace/clients', hint: 'Prospect to live engagement.' },
  { label: 'Placement', href: '/workspace/placements', hint: 'The wizard, then the live seat.' },
  { label: 'EOD and report', href: '/workspace/review/eods', hint: 'What needs a manager.' },
];

/** The Live rail, after the Vistrial app's right column: stacked cards. */
function LiveAside({ nav, onNavigate }: { nav: NavSection[]; onNavigate: NavigateHandler }) {
  const waiting = waitingOn(nav);
  const desks = nav.filter((section) => DESK_IDS.has(section.id));
  return (
    <aside aria-label="Live" className="sticky top-[104px] hidden h-[calc(100svh-104px)] w-80 shrink-0 space-y-4 overflow-y-auto px-4 py-6 xl:block">
      <section className="panel rounded-2xl p-4">
        <h2 className="flex items-center gap-2 text-[15px] font-medium text-white">
          {/* Vistrial's "waiting for you" marker. */}
          <CircleHelp className={cn('size-4', waiting.length ? 'text-brand-300' : 'text-neutral-500')} aria-hidden />
          Waiting on you
        </h2>
        {waiting.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">Nothing is waiting on you.</p>
        ) : (
          <ul className="mt-3 grid gap-1">
            {waiting.map((row, index) => (
              <li key={row.key} className="live-enter" style={{ animationDelay: `${index * 50}ms` }}>
                <Link
                  href={row.href}
                  prefetch
                  onClick={() => onNavigate(row.href)}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/[0.04]"
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-white', index === 0 && 'live-shimmer-text')}>{row.label}</span>
                    <span className="block text-[11px] text-neutral-500">{row.desk}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/12 px-2 py-0.5 text-[11px] font-medium tabular-nums text-brand-200">
                    <span aria-hidden className="size-1.5 rounded-full bg-brand-400" />
                    {row.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {desks.length ? (
        <section className="panel rounded-2xl p-4">
          <h2 className="text-[15px] font-medium text-white">How work moves</h2>
          <ol className="mt-3 grid gap-3">
            {FLOW_STEPS.map((step, index) => {
              const desk = desks[Math.min(index, desks.length - 1)];
              const busy = sectionCount(desk) > 0;
              return (
                <li key={step.label} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      busy ? 'bg-brand-400 live-pulse' : 'border border-white/25',
                    )}
                  />
                  <span>
                    <Link href={step.href} prefetch onClick={() => onNavigate(step.href)} className="text-sm text-white hover:text-brand-200">
                      {step.label}
                    </Link>
                    <span className="block text-xs text-neutral-500">{step.hint}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </aside>
  );
}

/** The crew strip under the header, after the Vistrial app: each desk and its state. */
function CrewStrip({ nav, onNavigate }: { nav: NavSection[]; onNavigate: NavigateHandler }) {
  const desks = nav.filter((section) => DESK_IDS.has(section.id));
  if (!desks.length) return null;
  return (
    <div aria-label="Desks" className="flex h-10 items-center gap-4 overflow-x-auto border-b border-border px-4 text-xs sm:px-6">
      {desks.map((section) => {
        const count = sectionCount(section);
        const href = railRows(section)[0]?.href ?? '/workspace';
        return (
          <Link key={section.id} href={href} prefetch onClick={() => onNavigate(href)} className="inline-flex shrink-0 items-center gap-2 text-neutral-400 hover:text-white">
            <span className="text-white">{section.heading}</span>
            <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5', count ? 'border-brand-400/30 bg-brand-500/10 text-brand-200' : 'border-white/[0.08] text-neutral-500')}>
              <LiveDot tone={count ? 'waiting' : 'clear'} className="size-1.5" />
              {count ? `${count} waiting` : 'Clear'}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function SearchResults({
  query,
  nav,
  active,
  onNavigate,
}: {
  query: string;
  nav: NavSection[];
  active: ActiveMatch | null;
  onNavigate: NavigateHandler;
}) {
  const hits = searchNav(nav, query);
  if (!hits.length) {
    return (
      <div className="px-3 py-10 text-center">
        <Search className="mx-auto mb-2 size-5 text-neutral-600" strokeWidth={1.8} aria-hidden />
        <p className="text-sm text-neutral-400">No pages match “{query.trim()}”.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-0.5" aria-label="Matching pages">
      {hits.map(({ section, item, leaf }, index) => {
        const current = active?.child ? active.child === leaf : active?.item === leaf;
        return (
          <li key={`${section.id}-${leaf.href}`}>
            <Link
              href={leaf.href}
              prefetch
              onClick={() => onNavigate(leaf.href)}
              className={cn(
                'group/row flex items-center gap-2.5 rounded-[10px] p-[5px] pr-2 outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400/60',
                current && 'bg-white/[0.06]',
              )}
            >
              <IconTile icon={leaf.icon} tone={section.tone} active={current || index === 0} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-neutral-100">{leaf.label}</span>
                <span className="block truncate text-[11px] text-neutral-500">
                  {section.heading}
                  {leaf !== item && item.label !== section.heading ? ` · ${item.label}` : ''}
                </span>
              </span>
              {index === 0 ? <CornerDownLeft className="size-3.5 text-neutral-500" strokeWidth={2} aria-hidden /> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserMenu({
  email,
  label,
  collapsed,
  variant,
  onSignOut,
}: {
  email: string;
  label: string;
  collapsed?: boolean;
  variant: 'sidebar' | 'header';
  onSignOut: () => void;
}) {
  const avatar = (
    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-400/45 to-brand-700/30 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/15">
      {initials(email)}
      <span className="absolute -bottom-px -right-px size-2.5 rounded-full bg-emerald-400 ring-2 ring-ink-900" aria-hidden />
    </span>
  );

  return (
    <Menu>
      {variant === 'header' ? (
        <MenuTrigger aria-label="Account" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60">
          {avatar}
        </MenuTrigger>
      ) : (
        <MenuTrigger
          aria-label="Account"
          className={cn(
            'relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] text-left outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400/60',
            collapsed ? 'justify-center p-1.5' : 'p-2',
          )}
        >
          {avatar}
          {collapsed ? null : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-white">{email.split('@')[0]}</span>
                <span className="block truncate text-[11px] text-neutral-500">{email}</span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-neutral-500" strokeWidth={2} aria-hidden />
            </>
          )}
          <BorderBeam size={60} duration={9} colorFrom="#9a88fc" colorTo="#52d6a4" borderWidth={1} />
        </MenuTrigger>
      )}
      <MenuPopup side={variant === 'header' ? 'bottom' : 'top'} align={variant === 'header' ? 'end' : 'start'} sideOffset={8} className="w-60">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium text-white">{email}</p>
          <p className="text-xs text-neutral-500">{label} workspace</p>
        </div>
        <MenuSeparator />
        {label === 'Admin' ? (
          <>
            <MenuLinkItem render={<Link href="/workspace/settings" prefetch />}>
              <Settings strokeWidth={1.9} aria-hidden />
              Workspace settings
            </MenuLinkItem>
            <MenuSeparator />
          </>
        ) : null}
        <MenuItem variant="destructive" onClick={onSignOut}>
          <LogOut strokeWidth={1.9} aria-hidden />
          Sign out
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}

function SidebarContent({
  nav,
  active,
  home,
  label,
  email,
  collapsed,
  instance,
  onNavigate,
  onToggleCollapsed,
  onSignOut,
}: {
  nav: NavSection[];
  active: ActiveMatch | null;
  home: string;
  label: string;
  email: string;
  collapsed: boolean;
  instance: 'rail' | 'drawer';
  onNavigate: NavigateHandler;
  onToggleCollapsed?: () => void;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const glowId = `da-admin-${instance}-active`;
  const searching = query.trim().length > 0;
  const searchId = instance === 'rail' ? SEARCH_ID : `${SEARCH_ID}-drawer`;
  const navRef = useRef<HTMLElement>(null);
  const activeHref = active?.child?.href ?? active?.item.href;

  useEffect(() => {
    const row = navRef.current?.querySelector('[aria-current="page"]');
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeHref, collapsed]);

  function navigate(href: string) {
    setQuery('');
    onNavigate(href);
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className={cn('relative flex h-16 shrink-0 items-center border-b border-white/[0.06]', collapsed ? 'justify-center' : 'justify-between pl-4 pr-2.5')}>
        <Link
          href={home}
          prefetch
          onClick={() => navigate(home)}
          className="flex items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-brand-400/60"
        >
          {collapsed ? (
            <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-brand-400/25 to-brand-700/10 ring-1 ring-inset ring-brand-300/25">
              <Logo markOnly tone="current" className="h-5 w-auto text-[color:var(--strong)]" />
            </span>
          ) : (
            <>
              <Logo tone="current" className="h-[21px] w-auto text-[color:var(--strong)]" />
              <span className="rounded-md border border-brand-400/30 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-200">
                {label}
              </span>
            </>
          )}
        </Link>
        {!collapsed && onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Collapse sidebar"
            className="flex size-8 items-center justify-center rounded-lg text-neutral-500 outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-brand-400/60"
          >
            <PanelLeftClose className="size-[17px]" strokeWidth={1.8} aria-hidden />
          </button>
        ) : null}
      </div>

      {collapsed ? (
        onToggleCollapsed ? (
          <div className="relative flex justify-center pb-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onToggleCollapsed}
                    aria-label="Expand sidebar"
                    className="flex size-9 items-center justify-center rounded-lg text-neutral-500 outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-brand-400/60"
                  />
                }
              >
                <PanelLeftOpen className="size-[17px]" strokeWidth={1.8} aria-hidden />
              </TooltipTrigger>
              <TooltipPopup side="right" sideOffset={10}>
                Expand sidebar <Kbd className="ml-1">[</Kbd>
              </TooltipPopup>
            </Tooltip>
          </div>
        ) : null
      ) : (
        <div className="relative px-3 pb-3">
          <label htmlFor={searchId} className="sr-only">
            Find a page
          </label>
          <div className="group/search relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 size-4 text-neutral-500 group-focus-within/search:text-brand-300" strokeWidth={1.9} aria-hidden />
            <input
              id={searchId}
              type="search"
              value={query}
              autoComplete="off"
              placeholder="Find a page"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setQuery('');
                  event.currentTarget.blur();
                }
                if (event.key === 'Enter') {
                  const first = searchNav(nav, query)[0];
                  if (first) {
                    navigate(first.leaf.href);
                    router.push(first.leaf.href);
                  }
                }
              }}
              className="h-10 w-full rounded-xl border border-white/[0.12] bg-white/[0.06] pl-8 pr-12 text-[13px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] placeholder:text-neutral-500 outline-none transition-[border-color,background-color,box-shadow] hover:border-brand-300/40 focus:border-brand-400/60 focus:shadow-[0_0_0_3px_rgba(154,136,252,0.2)] [&::-webkit-search-cancel-button]:hidden"
            />
            <span className="pointer-events-none absolute right-2 flex items-center gap-0.5">
              <Kbd className="bg-white/[0.06] text-neutral-400">⌘</Kbd>
              <Kbd className="bg-white/[0.06] text-neutral-400">K</Kbd>
            </span>
          </div>
        </div>
      )}

      <ScrollArea scrollFade className="relative flex-1">
        <nav ref={navRef} aria-label="Admin" className={cn('pb-4', collapsed ? 'px-2.5' : 'px-3')}>
          {searching && !collapsed ? (
            <SearchResults query={query} nav={nav} active={active} onNavigate={navigate} />
          ) : (
            collapsed ? (
              <div className="space-y-3">
                {nav.map((section) => (
                  <div key={section.id}>
                    <div className="mx-auto mb-2 h-px w-7 bg-white/[0.07]" aria-hidden />
                    <ul className="flex flex-col items-center gap-1">
                      {railRows(section).map((item) => (
                        <CollapsedItem
                          key={item.href}
                          section={section}
                          item={item}
                          active={active}
                          onNavigate={navigate}
                          glowId={glowId}
                          marked={section.rail === 'tabs' && active?.section.id === section.id}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <FolderTree nav={nav} active={active} onNavigate={navigate} />
            )
          )}
        </nav>
      </ScrollArea>

      <div className={cn('relative shrink-0 border-t border-white/[0.08] bg-white/[0.03]', collapsed ? 'p-2' : 'p-3')}>
        <UserMenu email={email} label={label} collapsed={collapsed} variant="sidebar" onSignOut={onSignOut} />
      </div>
    </div>
  );
}

export default function Shell({
  email,
  children,
  showAcademy = false,
  showHolds = false,
  holdsOnly = false,
  role = 'admin',
  counts,
}: {
  email: string;
  children: React.ReactNode;
  showAcademy?: boolean;
  showHolds?: boolean;
  holdsOnly?: boolean;
  role?: 'admin' | 'manager';
  counts?: NavCounts;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  // Both are tied to the path they were set on, so back/forward or any other
  // navigation drops them without an effect.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const [drawerOpenOn, setDrawerOpenOn] = useState<string | null>(null);
  const drawerOpen = drawerOpenOn === pathname;
  const signOutForm = useRef<HTMLFormElement>(null);

  const nav = useMemo(
    () => buildNav({ showAcademy, showHolds, holdsOnly, role, counts }),
    [showAcademy, showHolds, holdsOnly, role, counts],
  );
  const home = holdsOnly ? '/workspace/academy/holds' : role === 'manager' ? '/workspace/placements' : '/workspace/operators';
  const label = holdsOnly ? 'Review' : role === 'manager' ? 'Manager' : 'Admin';

  const navigating = pending !== null && pending.from === pathname;
  const active = findActive(nav, navigating ? pending.href : pathname);

  function handleNavigate(href: string) {
    setPending({ href, from: pathname });
    setDrawerOpenOn(null);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (window.matchMedia('(min-width: 1024px)').matches) {
          if (readCollapsed()) writeCollapsed(false);
          requestAnimationFrame(() => document.getElementById(SEARCH_ID)?.focus());
        } else {
          setDrawerOpenOn(window.location.pathname);
          requestAnimationFrame(() => document.getElementById(`${SEARCH_ID}-drawer`)?.focus());
        }
        return;
      }
      const target = event.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      if (event.key === '[' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        writeCollapsed(!readCollapsed());
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpenOn(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const signOut = () => signOutForm.current?.requestSubmit();
  const crumbs = active
    ? [active.section.heading, active.item.label, ...(active.child ? [active.child.label] : [])].filter(
        (crumb, index, all) => crumb !== all[index - 1],
      )
    : [label];

  return (
    <TooltipProvider delay={120}>
      <div className={cn('da-admin-shell relative isolate min-h-svh overflow-x-hidden bg-background text-card-foreground antialiased', interDisplay.variable)}>
        <form ref={signOutForm} action={signOutAction} hidden />

        <aside
          className={cn(
            'admin-rail fixed inset-y-0 left-0 z-40 hidden text-sidebar-foreground transition-[width] duration-200 ease-linear lg:block',
            collapsed ? 'w-[72px]' : 'w-[272px]',
          )}
        >
          <SidebarContent
            nav={nav}
            active={active}
            home={home}
            label={label}
            email={email}
            collapsed={collapsed}
            instance="rail"
            onNavigate={handleNavigate}
            onToggleCollapsed={() => writeCollapsed(!collapsed)}
            onSignOut={signOut}
          />
        </aside>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawerOpenOn(null)} />
            <motion.div
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              className="admin-rail absolute inset-y-0 left-0 w-[86vw] max-w-[300px] text-sidebar-foreground shadow-2xl"
            >
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpenOn(null)}
                className="absolute right-2.5 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/[0.06] hover:text-white"
              >
                <X className="size-[18px]" strokeWidth={1.8} aria-hidden />
              </button>
              <SidebarContent
                nav={nav}
                active={active}
                home={home}
                label={label}
                email={email}
                collapsed={false}
                instance="drawer"
                onNavigate={handleNavigate}
                onSignOut={signOut}
              />
            </motion.div>
          </div>
        ) : null}

        <div className={cn('relative z-10 flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-linear', collapsed ? 'lg:pl-[72px]' : 'lg:pl-[272px]')}>
          <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
            <CrewStrip nav={nav} onNavigate={handleNavigate} />
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpenOn(pathname)}
              aria-label="Open menu"
              className="flex size-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/[0.05] hover:text-white lg:hidden"
            >
              <MenuIcon className="size-5" strokeWidth={1.8} aria-hidden />
            </button>

            <nav aria-label="Breadcrumb" className="da-display flex min-w-0 items-center gap-2 text-sm">
              {active ? <span className="size-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden /> : null}
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <span key={`${crumb}-${index}`} className={cn('min-w-0 items-center gap-2', last ? 'flex' : 'hidden sm:flex')}>
                    {index > 0 ? <ChevronRight className={cn('size-3.5 shrink-0 text-neutral-600', last && 'hidden sm:block')} aria-hidden /> : null}
                    <span className={cn('truncate', last ? 'font-medium text-white' : 'text-neutral-500')}>{crumb}</span>
                  </span>
                );
              })}
              {navigating ? <span className="ml-1 size-1.5 animate-pulse rounded-full bg-brand-300" aria-label="Loading" /> : null}
            </nav>

            <button
              type="button"
              onClick={() => {
                if (window.matchMedia('(min-width: 1024px)').matches) {
                  if (collapsed) writeCollapsed(false);
                  requestAnimationFrame(() => document.getElementById(SEARCH_ID)?.focus());
                } else {
                  setDrawerOpenOn(pathname);
                  requestAnimationFrame(() => document.getElementById(`${SEARCH_ID}-drawer`)?.focus());
                }
              }}
              className="ml-auto hidden h-10 w-full max-w-md items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] pl-3 pr-1.5 text-left text-sm text-neutral-500 transition-colors hover:border-brand-400/40 hover:text-neutral-300 md:flex"
            >
              <Search className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
              <span className="flex-1 truncate">Jump to a desk, queue, or tool</span>
              <Kbd className="bg-white/[0.07] text-neutral-400">⌘K</Kbd>
            </button>
            <div className="ml-auto flex items-center gap-2 md:ml-0">
              <StatusPill>{label}</StatusPill>
              <ThemeToggle />
              <div className="lg:hidden">
                <UserMenu email={email} label={label} variant="header" onSignOut={signOut} />
              </div>
            </div>
            </div>
          </header>

          <div className="flex min-w-0 flex-1">
          <main id="workspace-main" className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
            <div className="app-enter mx-auto w-full min-w-0 max-w-[1400px]" key={pathname}>
              <SectionTabs active={active} />
              {children}
              <footer className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                <a href="https://acq.divineacquisition.io/privacy" className="hover:text-card-foreground">Privacy</a>
                <a href="https://acq.divineacquisition.io/terms" className="hover:text-card-foreground">Terms</a>
                <a href="https://acq.divineacquisition.io/disclaimer" className="hover:text-card-foreground">Disclaimer</a>
                <span className="ml-auto">Divine Acquisition</span>
              </footer>
            </div>
          </main>
          <LiveAside nav={nav} onNavigate={handleNavigate} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
