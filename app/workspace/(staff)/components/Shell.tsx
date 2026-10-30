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
  type NavCounts,
  type NavIcon,
  type NavItem,
  type NavSection,
  type NavTone,
} from '@/lib/workspace/adminNav';
import { interDisplay } from './fonts';

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
    <Glyph
      className={cn(
        'shrink-0',
        size === 'lg' ? 'size-[18px]' : 'size-4',
        active ? 'text-white' : 'text-neutral-500 group-hover/row:text-neutral-200',
      )}
      strokeWidth={1.9}
      aria-hidden
    />
  );
}

type NavigateHandler = (href: string) => void;

/** Spring-animated highlight shared by every row, so it glides to the new page. */
function ActiveGlow({ layoutId }: { layoutId: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 520, damping: 42 }}
      className="absolute inset-0 -z-10 rounded-lg bg-[#6A00FF]/20 shadow-[inset_2px_0_0_#6A00FF]"
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
          'flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-400/60',
          containsActive ? 'text-white' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100',
        )}
      >
        <IconTile icon={item.icon} tone={section.tone} active={containsActive} />
        <span className="truncate">{item.label}</span>
        {item.badge ? (
          <span className="ml-auto rounded-full bg-[#6A00FF] px-1.5 text-[10px] font-bold text-white tabular-nums">{item.badge}</span>
        ) : null}
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
                      <span className="absolute -left-[11.5px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[#6A00FF]" aria-hidden />
                      <ActiveGlow layoutId={glowId} />
                    </>
                  ) : null}
                  <Link
                    href={child.href}
                    prefetch
                    onClick={() => onNavigate(child.href)}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-400/60',
                      current ? 'font-medium text-white' : 'text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200',
                    )}
                  >
                    <Glyph className={cn('size-3.5 shrink-0', current ? 'text-brand-200' : 'opacity-70')} strokeWidth={1.9} aria-hidden />
                    <span className="truncate">{child.label}</span>
                    {child.badge ? (
                      <span className="ml-auto rounded-full bg-[#6A00FF] px-1.5 text-[10px] font-bold text-white tabular-nums">{child.badge}</span>
                    ) : null}
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
              <span className="absolute right-1 top-1 size-2 rounded-full bg-[#6A00FF]" aria-hidden />
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
              <Settings2 strokeWidth={1.9} aria-hidden />
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
                    <p className="mb-1.5 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300">
                      {section.heading}
                    </p>
                  )}
                  <ul className={collapsed ? 'flex flex-col items-center gap-1' : 'space-y-0.5'}>
                    {section.items.map((item) => {
                      const railItem = { ...item, children: undefined };
                      return collapsed ? (
                        <CollapsedItem
                          key={item.href}
                          section={section}
                          item={railItem}
                          active={active}
                          onNavigate={navigate}
                          glowId={glowId}
                        />
                      ) : (
                        <ExpandedItem
                          key={item.href}
                          section={section}
                          item={railItem}
                          active={active}
                          open={false}
                          onOpenChange={() => {}}
                          onNavigate={navigate}
                          glowId={glowId}
                        />
                      );
                    })}
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
  const home = holdsOnly ? '/workspace/academy/holds' : role === 'manager' ? '/workspace/team/workspace' : '/workspace/operations';
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
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div
            className="absolute -top-[22%] left-1/2 h-[520px] w-[820px] -translate-x-1/2"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(154,136,252,0.18) 0%, transparent 70%)',
              filter: 'blur(64px)',
              animation: 'app-breathe 9s ease-in-out infinite',
            }}
          />
          <div
            className="absolute right-[-12%] bottom-[-18%] h-[380px] w-[380px]"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(154,136,252,0.1) 0%, transparent 70%)',
              filter: 'blur(56px)',
              animation: 'app-breathe 11s ease-in-out infinite',
              animationDelay: '1.6s',
            }}
          />
        </div>
        <form ref={signOutForm} action={signOutAction} hidden />

        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 hidden bg-ink-900 text-sidebar-foreground transition-[width] duration-200 ease-linear lg:block',
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
              className="absolute inset-y-0 left-0 w-[86vw] max-w-[300px] bg-ink-900 text-sidebar-foreground shadow-2xl"
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
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
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
                className="hidden h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] pl-3 pr-1.5 text-xs text-muted-foreground transition-colors hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-card-foreground md:flex"
              >
                <Search className="size-3.5" strokeWidth={1.9} aria-hidden />
                Jump to
                <Kbd className="bg-white/[0.07] text-neutral-400">⌘K</Kbd>
              </button>
              <div className="lg:hidden">
                <UserMenu email={email} label={label} variant="header" onSignOut={signOut} />
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">
            <div className="mx-auto w-full min-w-0 max-w-[1400px]">
              {children}
              <footer className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                <a href="https://acq.divineacquisition.io/privacy" className="hover:text-card-foreground">Privacy</a>
                <a href="https://acq.divineacquisition.io/terms" className="hover:text-card-foreground">Terms</a>
                <a href="https://acq.divineacquisition.io/disclaimer" className="hover:text-card-foreground">Disclaimer</a>
                <span className="ml-auto">Divine Acquisition</span>
              </footer>
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
