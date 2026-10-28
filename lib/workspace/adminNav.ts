import type { ComponentType } from 'react';
import {
  BadgeDollarSign,
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  CalendarRange,
  ChartNoAxesCombined,
  ClipboardCheck,
  ClipboardList,
  Contact,
  Eye,
  FilePenLine,
  FileSignature,
  Funnel,
  Gauge,
  GraduationCap,
  HandCoins,
  Inbox,
  MessageSquareText,
  NotebookPen,
  Percent,
  PhoneCall,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Swords,
  Target,
  TriangleAlert,
  Trophy,
  UserPlus,
  UsersRound,
  Wallet,
} from 'lucide-react';

export type NavIcon = ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;

export type NavLeaf = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Other paths that open this same screen (legacy or mirrored routes). */
  aliases?: string[];
  /** Match the href itself only, not the pages beneath it. */
  exact?: boolean;
};

export type NavItem = NavLeaf & { children?: NavLeaf[] };

/** Each section gets its own hue so the icon tiles read as groups at a glance. */
export type NavTone = 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'fuchsia' | 'slate';

export type NavSection = { id: string; heading: string; tone: NavTone; items: NavItem[] };

/*
 * Integration plumbing (GoHighLevel, ingestion, notification routing),
 * credentials, lockdown, audit, field mapping, signing templates and other
 * configuration screens are deliberately left out. They still open by URL for
 * the people who maintain them; Settings sits in the account menu.
 */
/**
 * The rail stays short. Nested pages stay in the data so search and the
 * active state still find them; the sidebar itself does not list them.
 */
const WORKSPACE: NavSection = {
  id: 'workspace',
  heading: 'Workspace',
  tone: 'violet',
  items: [
    { href: '/workspace/operations', label: 'Overview', icon: Gauge },
    { href: '/workspace/pipeline', label: 'Pipeline', icon: Funnel },
    {
      href: '/workspace/admin/clients',
      label: 'Clients',
      icon: Building2,
      aliases: ['/workspace/admin', '/workspace/ops', '/workspace/ops/clients'],
      children: [
        { href: '/workspace/admin/escalations', label: 'Escalations', icon: TriangleAlert, aliases: ['/workspace/ops/escalations'] },
        { href: '/workspace/admin/bookings', label: 'Client bookings', icon: CalendarCheck2, aliases: ['/workspace/ops/bookings'] },
      ],
    },
    {
      href: '/workspace/admin/operators',
      label: 'Sales operators',
      icon: UsersRound,
      aliases: ['/workspace/ops/operators', '/workspace/team/board'],
      children: [
        { href: '/workspace/sales-ops', label: 'Workspace setup', icon: Target },
        { href: '/workspace/admin/payroll', label: 'Payroll', icon: Wallet, aliases: ['/workspace/ops/payroll'] },
        { href: '/workspace/admin/view-as', label: 'View as', icon: Eye },
        { href: '/workspace/team/queues', label: 'Queues', icon: Inbox },
        { href: '/workspace/team/scorecard', label: "DA's scorecard", icon: Trophy },
        { href: '/workspace/team/matching', label: 'Availability', icon: CalendarRange },
        { href: '/workspace/team', label: 'Roster & View As', icon: Contact, exact: true },
        { href: '/workspace/control/invites', label: 'Invites', icon: UserPlus, aliases: ['/ad/invites', '/ad/invite'] },
        { href: '/workspace/onboarding', label: 'Onboarding', icon: ClipboardList },
      ],
    },
    {
      href: '/workspace/calls',
      label: 'Sales',
      icon: PhoneCall,
      aliases: ['/workspace/hs/calls'],
      children: [
        { href: '/workspace/overview', label: 'VA performance', icon: ChartNoAxesCombined },
        { href: '/workspace/accounts', label: 'Accounts', icon: Stethoscope, aliases: ['/workspace/practices', '/workspace/hs/companies'] },
        { href: '/workspace/bookings', label: 'Prospect bookings', icon: CalendarCheck2 },
        { href: '/workspace/booking-messages', label: 'Message problems', icon: TriangleAlert },
        { href: '/workspace/calendar-links', label: 'Calendar links', icon: CalendarRange },
      ],
    },
    {
      href: '/workspace/agreements',
      label: 'Agreements',
      icon: FileSignature,
      children: [{ href: '/workspace/recipients', label: 'Recipients', icon: Contact }],
    },
    {
      href: '/workspace/growth',
      label: 'Growth',
      icon: Target,
      aliases: ['/da'],
      children: [
        { href: '/workspace/growth/new', label: 'New engagement', icon: Sparkles, aliases: ['/da/new'] },
        { href: '/workspace/growth/billing', label: 'Billing', icon: ReceiptText, aliases: ['/da/billing'] },
        { href: '/workspace/growth/payouts', label: 'Payouts', icon: HandCoins, aliases: ['/da/payouts'] },
        { href: '/workspace/growth/margin', label: 'Margin', icon: Percent, aliases: ['/da/margin'] },
        { href: '/workspace/growth/messages', label: 'Messages', icon: MessageSquareText, aliases: ['/da/messages'] },
        { href: '/admin', label: 'Assessments', icon: ClipboardCheck },
      ],
    },
  ],
};

const ACADEMY_ITEM: NavItem = {
  href: '/workspace/academy',
  label: 'Academy',
  icon: GraduationCap,
  children: [
    { href: '/workspace/academy/questions', label: 'Question bank', icon: BookOpenCheck },
    { href: '/workspace/academy/quizzes', label: 'Quizzes', icon: ClipboardList },
    { href: '/workspace/academy/simulations', label: 'Simulations', icon: Swords },
    { href: '/workspace/academy/rubrics', label: 'Rubrics', icon: ScrollText },
    { href: '/workspace/academy/offers', label: 'Offer packs', icon: BadgeDollarSign },
    { href: '/workspace/academy/practicals', label: 'Practicals', icon: FilePenLine },
    { href: '/workspace/academy/reflections', label: 'Reflections', icon: NotebookPen },
  ],
};

const HOLDS_ITEM: NavItem = {
  href: '/workspace/academy/holds',
  label: 'Holds',
  icon: ShieldCheck,
  children: [
    { href: '/workspace/academy/holds/grading', label: 'Grading', icon: ClipboardCheck },
    { href: '/workspace/academy/holds/practicals', label: 'Practicals', icon: FilePenLine },
    { href: '/workspace/academy/holds/summary', label: 'Summary', icon: ChartNoAxesCombined },
  ],
};

export function buildNav({
  showAcademy,
  showHolds,
  holdsOnly,
}: {
  showAcademy: boolean;
  showHolds: boolean;
  holdsOnly: boolean;
}): NavSection[] {
  if (holdsOnly) return [{ id: 'workspace', heading: 'Workspace', tone: 'violet', items: [HOLDS_ITEM] }];
  return [
    {
      ...WORKSPACE,
      items: [...WORKSPACE.items, ...(showAcademy ? [ACADEMY_ITEM] : []), ...(showHolds ? [HOLDS_ITEM] : [])],
    },
  ];
}

/** Top-level prefixes the app serves directly. Anything else on the admin host is a bare /workspace path. */
const ROUTED_PREFIXES = ['/workspace', '/workspace', '/ad', '/da', '/admin'];

/**
 * The admin host rewrites bare paths (/overview, /calls) into /workspace, so
 * the browser can show either form for the same screen.
 */
export function normalizePath(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/' || ROUTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return path;
  return `/workspace${path}`;
}

function matches(pathname: string, href: string, exact = false) {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

export type ActiveMatch = {
  section: NavSection;
  item: NavItem;
  /** Set when the match is one of the item's sub-pages. */
  child?: NavLeaf;
};

/**
 * The single most specific entry for a path. Longest href wins, so
 * /workspace/team/queues lights up "Queues" and not "Roster" too.
 */
export function findActive(nav: NavSection[], pathname: string): ActiveMatch | null {
  const path = normalizePath(pathname);
  let best: ActiveMatch | null = null;
  let bestLength = -1;
  for (const section of nav) {
    for (const item of section.items) {
      for (const leaf of [item, ...(item.children ?? [])]) {
        for (const href of [leaf.href, ...(leaf.aliases ?? [])]) {
          if (matches(path, href, leaf.exact) && href.length > bestLength) {
            best = leaf === item ? { section, item } : { section, item, child: leaf };
            bestLength = href.length;
          }
        }
      }
    }
  }
  return best;
}

export type SearchHit = { section: NavSection; item: NavItem; leaf: NavLeaf };

/** Case-insensitive match on the entry, its parent, or its section. */
export function searchNav(nav: NavSection[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const section of nav) {
    for (const item of section.items) {
      for (const leaf of [item, ...(item.children ?? [])]) {
        const haystack = `${leaf.label} ${leaf === item ? '' : item.label} ${section.heading}`.toLowerCase();
        if (haystack.includes(q)) hits.push({ section, item, leaf });
      }
    }
  }
  return hits;
}
