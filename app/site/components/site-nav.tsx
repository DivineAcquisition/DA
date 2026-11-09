'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Compass,
  House,
  Building2,
  Layers,
  Menu,
  Quote,
  Sparkles,
  Target,
  UserRound,
  Workflow,
  X,
} from 'lucide-react';

import { DIAGNOSTIC_PATH, NAV, type NavGroup, type NavLink } from '@/lib/site/content';
import { cn } from '@/lib/utils';

const ICONS: Record<NonNullable<NavLink['icon']>, ReactNode> = {
  sales: <Target className="size-[18px]" aria-hidden />,
  b2b: <Building2 className="size-[18px]" aria-hidden />,
  local: <House className="size-[18px]" aria-hidden />,
  // eslint-disable-next-line @next/next/no-img-element
  vistrial: <img src="/site/brand/vistrial-icon.png" alt="" width={22} height={22} className="size-[22px] rounded-[6px]" />,
  more: <Sparkles className="size-[18px]" aria-hidden />,
  approach: <Workflow className="size-[18px]" aria-hidden />,
  work: <BookOpen className="size-[18px]" aria-hidden />,
  philosophy: <Quote className="size-[18px]" aria-hidden />,
  founder: <UserRound className="size-[18px]" aria-hidden />,
  fit: <Compass className="size-[18px]" aria-hidden />,
};

function linkProps(link: NavLink) {
  return link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}

function DropdownItem({ link, onNavigate }: { link: NavLink; onNavigate: () => void }) {
  const body = (
    <>
      <span
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
          link.icon === 'vistrial' ? 'bg-black shadow-[inset_0_0_0_1px_rgba(154,136,252,0.22)]' : 'da-icon-tile',
        )}
      >
        {link.icon ? ICONS[link.icon] : <Layers className="size-[18px]" aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          {link.label}
          {link.badge ? (
            <span className="da-mono rounded-full bg-[#9a88fc]/20 px-2 py-0.5 text-[9px] tracking-[0.14em] text-[#c3b6fe] uppercase">{link.badge}</span>
          ) : null}
          {link.external ? <ArrowUpRight className="size-3.5 text-white/40" aria-hidden /> : null}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-white/50">{link.description}</span>
      </span>
    </>
  );
  if (link.muted) {
    return <div className="flex items-start gap-3 rounded-xl p-3 opacity-60">{body}</div>;
  }
  return (
    <a
      href={link.href}
      {...linkProps(link)}
      onClick={onNavigate}
      className="flex items-start gap-3 rounded-xl p-3 outline-none transition-colors hover:bg-[#211c30] focus-visible:bg-[#251f36]"
    >
      {body}
    </a>
  );
}

function Dropdown({
  group,
  open,
  onOpen,
  onClose,
}: {
  group: NavGroup;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const panelId = useId();
  const closeTimer = useRef<number | undefined>(undefined);
  const wide = group.id === 'company';

  const hoverOpen = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    window.clearTimeout(closeTimer.current);
    onOpen();
  };
  const hoverClose = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    closeTimer.current = window.setTimeout(onClose, 140);
  };

  return (
    <div className="relative" onPointerEnter={hoverOpen} onPointerLeave={hoverClose}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? onClose() : onOpen())}
        className={cn(
          'flex h-9 items-center gap-1 rounded-full px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#9a88fc]',
          open ? 'bg-[#28223a] text-white' : 'text-white/75 hover:text-white',
        )}
      >
        {group.label}
        <ChevronDown className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
            className="absolute top-full left-1/2 z-50 -translate-x-1/2 pt-3"
          >
            <div
              className={cn(
                'da-hairline-top overflow-hidden rounded-2xl border border-[#9a88fc]/20 bg-[#13111c]/95 p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9),0_0_60px_-30px_rgba(154,136,252,0.6)] backdrop-blur-xl',
                wide ? 'grid w-[560px] grid-cols-2 gap-1' : 'w-[400px]',
              )}
            >
              {group.links.map((link) => (
                <DropdownItem key={link.label} link={link} onNavigate={onClose} />
              ))}
              {group.id === 'services' ? (
                <a
                  href={DIAGNOSTIC_PATH}
                  onClick={onClose}
                  className="mt-1 flex items-center justify-between rounded-xl bg-[#9a88fc]/15 px-4 py-3 text-sm text-[#dcd3ff] transition-colors hover:bg-[#9a88fc]/25"
                >
                  <span>Book your Sales Operations diagnostic</span>
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-40 overflow-y-auto bg-[#0b0a11]/97 px-4 pt-24 pb-10 backdrop-blur-xl lg:hidden"
    >
      <nav aria-label="Mobile" className="mx-auto max-w-md space-y-8">
        {NAV.map((group) => (
          <div key={group.id}>
            <p className="da-mono mb-2 px-3 text-[11px] tracking-[0.18em] text-[#9a88fc] uppercase">{group.label}</p>
            <div className="space-y-1">
              {group.links.map((link) => (
                <DropdownItem key={link.label} link={link} onNavigate={onClose} />
              ))}
            </div>
          </div>
        ))}
        <a
          href={DIAGNOSTIC_PATH}
          className="da-btn-primary flex h-12 items-center justify-center rounded-xl text-[15px] font-medium text-white"
        >
          <span className="relative z-[1]">Book a diagnostic</span>
        </a>
      </nav>
    </motion.div>
  );
}

export function SiteNav() {
  const [open, setOpen] = useState<NavGroup['id'] | null>(null);
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(null);
        setMobile(false);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = mobile ? 'hidden' : '';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [mobile]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <div
          ref={barRef}
          className={cn(
            'mx-auto flex h-14 max-w-[1200px] items-center justify-between rounded-2xl pr-2 pl-4 transition-all duration-300 sm:pl-5',
            scrolled || mobile
              ? 'border border-[#9a88fc]/15 bg-[#12101a]/80 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl'
              : 'border border-transparent',
          )}
        >
          <a href="#top" aria-label="Divine Acquisition home" className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#9a88fc]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/brand/da-wordmark.png" alt="Divine Acquisition" width={900} height={138} className="h-[22px] w-auto sm:h-6" />
          </a>

          <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((group) => (
              <Dropdown
                key={group.id}
                group={group}
                open={open === group.id}
                onOpen={() => setOpen(group.id)}
                onClose={() => setOpen((current) => (current === group.id ? null : current))}
              />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={DIAGNOSTIC_PATH}
              className="da-btn-primary hidden h-10 items-center rounded-xl px-4 text-sm font-medium text-white sm:inline-flex"
            >
              <span className="relative z-[1]">Book a diagnostic</span>
            </a>
            <button
              type="button"
              aria-label={mobile ? 'Close menu' : 'Open menu'}
              aria-expanded={mobile}
              onClick={() => setMobile((value) => !value)}
              className="flex size-10 items-center justify-center rounded-xl text-white/80 outline-none hover:bg-[#251f36] focus-visible:ring-2 focus-visible:ring-[#9a88fc] lg:hidden"
            >
              {mobile ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
      </header>
      <AnimatePresence>{mobile ? <MobileMenu onClose={() => setMobile(false)} /> : null}</AnimatePresence>
    </>
  );
}
