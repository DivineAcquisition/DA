'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CornerDownLeft,
  LogOut,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import Logo from '@/app/components/Logo';
import { BorderBeam } from '@/components/ui/border-beam';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Kbd } from '@/components/ui/kbd';
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuLinkItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { signOutAction } from '@/lib/workspace/actions';
import { cn } from '@/lib/utils';
import {
  buildNav,
  findActive,
  searchNav,
  type ActiveMatch,
  type NavIcon,
  type NavItem,
  type NavSection,
  type NavTone,
} from '@/lib/workspace/adminNav';
import { interDisplay } from './fonts';

const TONES: Record<NavTone, { active: string; idle: string; dot: string; text: string }> = {
  violet: {
    active: 'bg-linear-to-br from-violet-400/35 to-violet-600/10 ring-violet-300/35 text-violet-100 shadow-[0_0_18px_-4px] shadow-violet-500/50',
    idle: 'text-violet-300/75',
    dot: 'bg-violet-400',
    text: 'text-violet-300',
  },
  sky: {
    active: 'bg-linear-to-br from-sky-400/35 to-sky-600/10 ring-sky-300/35 text-sky-100 shadow-[0_0_18px_-4px] shadow-sky-500/50',
    idle: 'text-sky-300/75',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
  },
  emerald: {
    active: 'bg-linear-to-br from-emerald-400/35 to-emerald-600/10 ring-emerald-300/35 text-emerald-100 shadow-[0_0_18px_-4px] shadow-emerald-500/50',
    idle: 'text-emerald-300/75',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
  },
  amber: {
    active: 'bg-linear-to-br from-amber-400/35 to-amber-600/10 ring-amber-300/35 text-amber-100 shadow-[0_0_18px_-4px] shadow-amber-500/50',
    idle: 'text-amber-300/75',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
  },
  rose: {
    active: 'bg-linear-to-br from-rose-400/35 to-rose-600/10 ring-rose-300/35 text-rose-100 shadow-[0_0_18px_-4px] shadow-rose-500/50',
    idle: 'text-rose-300/75',
    dot: 'bg-rose-400',
    text: 'text-rose-300',
  },
  fuchsia: {
    active: 'bg-linear-to-br from-fuchsia-400/35 to-fuchsia-600/10 ring-fuchsia-300/35 text-fuchsia-100 shadow-[0_0_18px_-4px] shadow-fuchsia-500/50',
    idle: 'text-fuchsia-300/75',
    dot: 'bg-fuchsia-400',
    text: 'text-fuchsia-300',
  },
  slate: {
    active: 'bg-linear-to-br from-slate-300/30 to-slate-500/10 ring-slate-200/30 text-slate-100 shadow-[0_0_18px_-4px] shadow-slate-400/40',
    idle: 'text-slate-300/75',
    dot: 'bg-slate-300',
    text: 'text-slate-300',
  },
};

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

function IconTile({ icon: Glyph, tone, active, size = 'md' }: { icon: NavIcon; tone: NavTone; active: boolean; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-[9px] ring-1 ring-inset transition-[background-color,box-shadow,color] duration-200',
        size === 'lg' ? 'size-9' : 'size-7',
        active
          ? TONES[tone].active
          : cn('bg-white/[0.035] ring-white/[0.07] group-hover/row:bg-white/[0.07] group-hover/row:ring-white/[0.12]', TONES[tone].idle),
      )}
    >
      <Glyph className={size === 'lg' ? 'size-[17px]' : 'size-[15px]'} strokeWidth={1.9} aria-hidden />
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
      className="absolute inset-0 -z-10 rounded-[10px] bg-linear-to-r from-white/[0.085] to-white/[0.025] ring-1 ring-inset ring-white/[0.08]"
      aria-hidden
    />
  );
}

function ExpandedItem({
  section,
  item,
  active,
  open,
  onOpenChange,
  onNavigate,
  glowId,
}: {
  section: NavSection;
  item: NavItem;
  active: ActiveMatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: NavigateHandler;
  glowId: string;
}) {
  const containsActive = active?.item === item;
  const isCurrent = containsActive && !active?.child;
  const children = item.children ?? [];

  const row = (
    <div className="group/row relative isolate flex items-center">
      {isCurrent ? <ActiveGlow layoutId={glowId} /> : null}
      <Link
        href={item.href}
        prefetch
        onClick={() => onNavigate(item.href)}
        aria-current={isCurrent ? 'page' : undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] py-[5px] pl-[5px] pr-2 text-[13.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-400/60',
          containsActive ? 'text-white' : 'text-neutral-400 hover:bg-white/[0.035] hover:text-neutral-100',
        )}
      >
        <IconTile icon={item.icon} tone={section.tone} active={containsActive} />
        <span className="truncate">{item.label}</span>
      </Link>
      {children.length ? (
        <CollapsibleTrigger
          aria-label={`${open ? 'Hide' : 'Show'} ${item.label} pages`}
          className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-500 outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-brand-400/60"
        >
          <ChevronDown className={cn('size-3.5 transition-transform duration-200', open ? 'rotate-0' : '-rotate-90')} strokeWidth={2} aria-hidden />
        </CollapsibleTrigger>
      ) : null}
    </div>
  );

  if (!children.length) return <li>{row}</li>;

  return (
    <li>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        {row}
        <CollapsiblePanel>
          <ul className="relative ml-[19px] mt-0.5 space-y-px border-l border-white/[0.07] pb-1 pl-2.5">
            {children.map((child) => {
              const current = active?.child === child;
              const Glyph = child.icon;
              return (
                <li key={child.href} className="relative isolate">
                  {current ? (
                    <>
                      <span className={cn('absolute -left-[11.5px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full', TONES[section.tone].dot)} aria-hidden />
                      <ActiveGlow layoutId={glowId} />
                    </>
                  ) : null}
                  <Link
                    href={child.href}
                    prefetch
                    onClick={() => onNavigate(child.href)}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-[10px] px-2 py-[5px] text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-400/60',
                      current ? 'font-medium text-white' : 'text-neutral-500 hover:bg-white/[0.035] hover:text-neutral-200',
                    )}
                  >
                    <Glyph className={cn('size-3.5 shrink-0', current ? TONES[section.tone].text : 'opacity-70')} strokeWidth={1.9} aria-hidden />
                    <span className="truncate">{child.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CollapsiblePanel>
      </Collapsible>
    </li>
  );
}

function CollapsedItem({
  section,
  item,
  active,
  onNavigate,
  glowId,
}: {
  section: NavSection;
  item: NavItem;
  active: ActiveMatch | null;
  onNavigate: NavigateHandler;
  glowId: string;
}) {
  const containsActive = active?.item === item;
  const children = item.children ?? [];
  const tileClass =
    'group/row relative isolate flex size-11 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60';

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
            <span className="sr-only">{item.label}</span>
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
              <span className={cn('size-1.5 rounded-full', TONES[section.tone].dot)} aria-hidden />
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
                  <Glyph className={cn(current && TONES[section.tone].text)} strokeWidth={1.9} aria-hidden />
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
            <MenuLinkItem render={<Link href="/vistrial/team/ghl/activity" prefetch />}>
              <Radar strokeWidth={1.9} aria-hidden />
              Live activity
            </MenuLinkItem>
            <MenuLinkItem render={<Link href="/workspace/settings" prefetch />}>
              <Settings2 strokeWidth={1.9} aria-hidden />
              Settings
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
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
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
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(120%_70%_at_0%_0%,rgba(154,136,252,0.16),transparent_70%)]"
        aria-hidden
      />

      <div className={cn('relative flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'justify-between pl-4 pr-2.5')}>
        <Link
          href={home}
          prefetch
          onClick={() => navigate(home)}
          className="flex items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-brand-400/60"
        >
          {collapsed ? (
            <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-brand-400/25 to-brand-700/10 ring-1 ring-inset ring-brand-300/25">
              <Logo markOnly className="h-5 w-auto" />
            </span>
          ) : (
            <>
              <Logo className="h-[21px] w-auto" />
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
              className="h-9 w-full rounded-[10px] border border-white/[0.08] bg-white/[0.03] pl-8 pr-12 text-[13px] text-white placeholder:text-neutral-500 outline-none transition-[border-color,background-color,box-shadow] hover:border-white/[0.14] focus:border-brand-400/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px] focus:shadow-brand-500/15 [&::-webkit-search-cancel-button]:hidden"
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
            <div className={collapsed ? 'space-y-3' : 'space-y-5'}>
              {nav.map((section) => (
                <div key={section.id}>
                  {collapsed ? (
                    <div className="mx-auto mb-2 h-px w-7 bg-white/[0.07]" aria-hidden />
                  ) : (
                    <p className="da-display mb-1.5 flex items-center gap-2 px-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      <span className={cn('size-1.5 rounded-full opacity-80', TONES[section.tone].dot)} aria-hidden />
                      {section.heading}
                    </p>
                  )}
                  <ul className={collapsed ? 'flex flex-col items-center gap-1' : 'space-y-0.5'}>
                    {section.items.map((item) =>
                      collapsed ? (
                        <CollapsedItem
                          key={item.href}
                          section={section}
                          item={item}
                          active={active}
                          onNavigate={navigate}
                          glowId={glowId}
                        />
                      ) : (
                        <ExpandedItem
                          key={item.href}
                          section={section}
                          item={item}
                          active={active}
                          open={openOverrides[item.href] ?? active?.item === item}
                          onOpenChange={(open) => setOpenOverrides((current) => ({ ...current, [item.href]: open }))}
                          onNavigate={navigate}
                          glowId={glowId}
                        />
                      ),
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </nav>
      </ScrollArea>

      <div className={cn('relative shrink-0 border-t border-white/[0.06]', collapsed ? 'p-2' : 'p-3')}>
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
}: {
  email: string;
  children: React.ReactNode;
  showAcademy?: boolean;
  showHolds?: boolean;
  holdsOnly?: boolean;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  // Both are tied to the path they were set on, so back/forward or any other
  // navigation drops them without an effect.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const [drawerOpenOn, setDrawerOpenOn] = useState<string | null>(null);
  const drawerOpen = drawerOpenOn === pathname;
  const signOutForm = useRef<HTMLFormElement>(null);

  const nav = useMemo(() => buildNav({ showAcademy, showHolds, holdsOnly }), [showAcademy, showHolds, holdsOnly]);
  const home = holdsOnly ? '/workspace/academy/holds' : '/vistrial/ops';
  const label = holdsOnly ? 'Review' : 'Admin';

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
      <div className={cn('da-admin-shell relative flex min-h-screen bg-ink-950 text-white antialiased', interDisplay.variable)}>
        <form ref={signOutForm} action={signOutAction} hidden />

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 hidden border-r border-white/[0.06] bg-ink-900 transition-[width] duration-200 ease-out lg:block',
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
              className="absolute inset-y-0 left-0 w-[86vw] max-w-[300px] border-r border-white/[0.06] bg-ink-900 shadow-2xl"
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

        <div className={cn('relative z-10 flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out', collapsed ? 'lg:pl-[72px]' : 'lg:pl-[272px]')}>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-ink-950/80 px-4 backdrop-blur-xl sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpenOn(pathname)}
              aria-label="Open menu"
              className="flex size-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/[0.05] hover:text-white lg:hidden"
            >
              <MenuIcon className="size-5" strokeWidth={1.8} aria-hidden />
            </button>

            <nav aria-label="Breadcrumb" className="da-display flex min-w-0 items-center gap-2 text-sm">
              {active ? <span className={cn('size-1.5 shrink-0 rounded-full', TONES[active.section.tone].dot)} aria-hidden /> : null}
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

            <div className="ml-auto flex items-center gap-2">
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
                className="hidden h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] pl-3 pr-1.5 text-xs text-neutral-400 transition-colors hover:border-white/20 hover:text-white md:flex"
              >
                <Search className="size-3.5" strokeWidth={1.9} aria-hidden />
                Jump to
                <Kbd className="bg-white/[0.07] text-neutral-400">⌘K</Kbd>
              </button>
              {!holdsOnly ? (
                <Link
                  href="/vistrial/team/ghl/activity"
                  prefetch
                  onClick={() => handleNavigate('/vistrial/team/ghl/activity')}
                  className="hidden h-8 items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 text-xs font-medium text-emerald-200 transition-colors hover:border-emerald-300/40 hover:bg-emerald-400/10 sm:flex"
                >
                  <span className="relative flex size-2" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                  </span>
                  Live activity
                </Link>
              ) : null}
              <div className="lg:hidden">
                <UserMenu email={email} label={label} variant="header" onSignOut={signOut} />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
