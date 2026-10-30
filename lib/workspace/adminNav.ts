import type { ComponentType } from 'react';
import { navSlots } from '@/lib/workspace/nav-slots';
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
  FilePenLine,
  FileSignature,
  Funnel,
  Gauge,
  LayoutDashboard,
  GraduationCap,
  HandCoins,
  Inbox,
  MessageSquareText,
  NotebookPen,
  Percent,
  PhoneCall,
  ReceiptText,
  ScrollText,
  Settings2,
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
  /** A count that needs action. Zero stays hidden. */
  badge?: number;
};

export type NavItem = NavLeaf & { children?: NavLeaf[] };

/** Each section gets its own hue so the icon tiles read as groups at a glance. */
export type NavTone = 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'fuchsia' | 'slate';

export type NavSection = { id: string; heading: string; tone: NavTone; items: NavItem[] };

/**
 * One home per screen. Seven groups for DA Admin. Managers get Home, Team,
 * and Inbox from the same list. Nested pages are children, so search and the
 * active state find them.
 */
export type NavCounts = {
  home: number;
  escalations: number;
  /** EODs that need review. Shown on the Team Workspace EODs tab. */
  eods?: number;
  /** Reports in Ready for Review. Shown on the Team Workspace Reports tab. */
  reports?: number;
  /** Open academy holds. Shown on Holds. */
  holds?: number;
};

const withBadge = (item: NavLeaf, count: number | undefined): NavLeaf =>
  count && count > 0 ? { ...item, badge: count } : item;

function homeSection(counts?: NavCounts): NavSection {
  return {
    id: 'home',
    heading: 'Home',
    tone: 'violet',
    items: [
      withBadge({ href: '/workspace/operations', label: 'Overview', icon: Gauge }, counts?.home),
      { href: '/workspace/inbox', label: 'Inbox', icon: Inbox },
    ],
  };
}

function teamSection(): NavSection {
  return {
    id: 'team',
    heading: 'Team',
    tone: 'sky',
    items: [
      { href: '/workspace/team/workspace', label: 'Team Workspace', icon: LayoutDashboard },
      { href: '/workspace/sales-ops/placements', label: 'Placements', icon: Target },
      { href: '/workspace/team/board', label: 'Board', icon: LayoutDashboard },
      { href: '/workspace/team/queues', label: 'Queues', icon: Inbox },
      { href: '/workspace/team/matching', label: 'Availability', icon: CalendarRange },
      { href: '/workspace/team/scorecard', label: 'Scorecard', icon: Trophy },
      { href: '/workspace/team', label: 'Roster and View As', icon: Contact, exact: true, aliases: ['/workspace/admin/view-as'] },
    ],
  };
}

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

function holdsItem(count?: number): NavItem {
  return {
    href: '/workspace/academy/holds',
    label: 'Holds',
    icon: ShieldCheck,
    badge: count && count > 0 ? count : undefined,
    children: [
      { href: '/workspace/academy/holds/grading', label: 'Grading', icon: ClipboardCheck },
      { href: '/workspace/academy/holds/practicals', label: 'Practicals', icon: FilePenLine },
      { href: '/workspace/academy/holds/summary', label: 'Summary', icon: ChartNoAxesCombined },
    ],
  };
}

export function buildNav({
  showAcademy,
  showHolds,
  holdsOnly,
  role = 'admin',
  counts,
}: {
  showAcademy: boolean;
  showHolds: boolean;
  holdsOnly: boolean;
  role?: 'admin' | 'manager';
  counts?: NavCounts;
}): NavSection[] {
  if (holdsOnly) return [{ id: 'people', heading: 'People', tone: 'fuchsia', items: [holdsItem(counts?.holds)] }];
  if (role === 'manager') {
    return [
      { id: 'home', heading: 'Home', tone: 'violet', items: [withBadge({ href: '/workspace/operations', label: 'Overview', icon: Gauge }, counts?.home)] },
      teamSection(),
      { id: 'inbox', heading: 'Inbox', tone: 'amber', items: [{ href: '/workspace/inbox', label: 'Inbox', icon: Inbox }] },
    ];
  }

  const people: NavItem[] = [
    { href: '/workspace/admin/operators', label: 'Operators', icon: UsersRound, aliases: ['/workspace/ops/operators'] },
    { href: '/workspace/control/invites', label: 'Invites', icon: UserPlus, aliases: ['/ad/invites', '/ad/invite'] },
    { href: '/workspace/onboarding', label: 'Onboarding', icon: ClipboardList },
    { href: '/admin', label: 'Assessments', icon: ClipboardCheck },
    {
      href: '/workspace/agreements',
      label: 'Agreements',
      icon: FileSignature,
      children: [{ href: '/workspace/recipients', label: 'Recipients', icon: Contact }],
    },
    ...(showAcademy ? [ACADEMY_ITEM] : []),
    ...(showHolds ? [holdsItem(counts?.holds)] : []),
  ];

  return [
    homeSection(counts),
    teamSection(),
    { id: 'people', heading: 'People', tone: 'fuchsia', items: people },
    {
      id: 'sales',
      heading: 'Sales',
      tone: 'emerald',
      items: [
        { href: '/workspace/pipeline', label: 'Pipeline', icon: Funnel },
        {
          href: '/workspace/calls',
          label: 'Sales calls',
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
        { href: '/workspace/acq-applications', label: 'Coaching applications', icon: FilePenLine },
        { href: '/workspace/growth/ingestion', label: 'Ingestion', icon: Sparkles, aliases: ['/da/ingestion'] },
      ],
    },
    {
      id: 'clients',
      heading: 'Clients',
      tone: 'amber',
      items: [
        {
          href: '/workspace/admin/clients',
          label: 'Case files',
          icon: Building2,
          aliases: ['/workspace/admin', '/workspace/ops', '/workspace/ops/clients'],
          children: [
            withBadge(
              { href: '/workspace/admin/escalations', label: 'Escalations', icon: TriangleAlert, aliases: ['/workspace/ops/escalations'] },
              counts?.escalations,
            ),
            { href: '/workspace/admin/bookings', label: 'Client bookings', icon: CalendarCheck2, aliases: ['/workspace/ops/bookings'] },
          ],
        },
        {
          href: '/workspace/growth',
          label: 'Growth',
          icon: Target,
          aliases: ['/da'],
          children: [{ href: '/workspace/growth/new', label: 'New engagement', icon: Sparkles, aliases: ['/da/new'] }],
        },
        { href: '/workspace/growth/messages', label: 'Messages', icon: MessageSquareText, aliases: ['/da/messages'] },
        {
          href: '/workspace/team/ghl',
          label: 'GHL',
          icon: PhoneCall,
          children: [
            { href: '/workspace/team/ghl/access', label: 'Access', icon: ShieldCheck },
            { href: '/workspace/team/ghl/activity', label: 'Activity health', icon: ChartNoAxesCombined },
            { href: '/workspace/team/ghl/unattributed', label: 'Unattributed', icon: TriangleAlert },
            { href: '/workspace/team/ghl/routing', label: 'Routing log', icon: Funnel },
            { href: '/workspace/team/ghl/standard', label: 'Standard', icon: ScrollText },
          ],
        },
      ],
    },
    {
      id: 'finance',
      heading: 'Finance',
      tone: 'rose',
      items: [
        { href: '/workspace/admin/payroll', label: 'Payroll', icon: Wallet, aliases: ['/workspace/ops/payroll'] },
        { href: '/workspace/growth/billing', label: 'Billing', icon: ReceiptText, aliases: ['/da/billing'] },
        { href: '/workspace/growth/payouts', label: 'Payouts', icon: HandCoins, aliases: ['/da/payouts'] },
        { href: '/workspace/growth/margin', label: 'Margin', icon: Percent, aliases: ['/da/margin'] },
        ...(navSlots.payImpact
          ? [{ href: '/workspace/growth/pay-impact', label: 'Pay Impact', icon: HandCoins }]
          : []),
      ],
    },
    {
      id: 'admin',
      heading: 'Admin',
      tone: 'slate',
      items: [
        { href: '/workspace/team/workspace/integrity', label: 'Data integrity', icon: ShieldCheck },
        { href: '/workspace/team/workspace/reports/deliveries', label: 'Deliveries', icon: ScrollText },
        {
          href: '/workspace/sales-ops/settings',
          label: 'Sales settings',
          icon: Settings2,
          aliases: ['/workspace/sales-ops'],
          children: [
            { href: '/workspace/sales-ops/metrics', label: 'Metrics', icon: ChartNoAxesCombined },
            { href: '/workspace/sales-ops/targets', label: 'Targets', icon: Target },
            { href: '/workspace/sales-ops/tasks', label: 'Tasks', icon: ClipboardList },
          ],
        },
        { href: '/workspace/team/settings', label: 'Team settings', icon: Settings2 },
        { href: '/workspace/settings', label: 'Workspace settings', icon: Settings2 },
        { href: '/workspace/templates', label: 'Templates', icon: FileSignature },
        { href: '/workspace/mapping', label: 'Field mapping', icon: NotebookPen },
        { href: '/workspace/ops/notifications', label: 'Notifications routing', icon: Inbox, aliases: ['/workspace/admin/notifications'] },
        {
          href: '/workspace/control',
          label: 'Control',
          icon: ShieldCheck,
          children: [
            { href: '/workspace/control/alerts', label: 'Alerts', icon: TriangleAlert },
            { href: '/workspace/control/audit', label: 'Audit', icon: ScrollText },
            { href: '/workspace/control/credentials', label: 'Credentials', icon: ShieldCheck },
            { href: '/workspace/control/lockdown', label: 'Lockdown', icon: ShieldCheck },
          ],
        },
      ],
    },
  ];
}

/** Top-level prefixes the app serves directly. Anything else on the admin host is a bare /workspace path. */
const ROUTED_PREFIXES = ['/workspace', '/ad', '/da', '/admin'];

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
