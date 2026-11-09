import type { ComponentType } from 'react';
import { navSlots } from '@/lib/workspace/nav-slots';
// Icons follow the Vistrial operator app's vocabulary (lucide-react, as used in
// src/components/shell): the same glyph for the same idea across both products.
import {
  Activity,
  BookOpen,
  Bot,
  Brain,
  Building2,
  CheckCircle2,
  CircleHelp,
  Compass,
  FileText,
  Gauge,
  LayoutGrid,
  LayoutList,
  Link,
  Megaphone,
  MessagesSquare,
  NotebookPen,
  Plug,
  Plus,
  Scale,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
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

/**
 * `links` puts every item on the sidebar. `tabs` keeps one sidebar row and
 * opens the rest as tabs on the page.
 */
export type NavRail = 'links' | 'tabs';

export type NavSection = {
  id: string;
  heading: string;
  tone: NavTone;
  rail?: NavRail;
  /** Where the collapsed row opens. Defaults to the first item. */
  href?: string;
  /** The collapsed row's icon. Defaults to the first item's. */
  icon?: NavIcon;
  items: NavItem[];
};

/** What the sidebar actually lists. Tab sections collapse to a single row. */
export function railRows(section: NavSection): NavItem[] {
  if (section.rail !== 'tabs' || section.items.length < 2) return section.items;
  const badge = section.items.reduce((sum, item) => sum + (item.badge ?? 0), 0);
  const first = section.items[0];
  return [{ href: section.href ?? first.href, label: section.heading, icon: section.icon ?? first.icon, badge: badge || undefined }];
}

/**
 * One lifecycle, four desks. Operators (application to ready), Clients
 * (prospect to the life of the case file), Placements (the wizard, then the
 * live seat), and Review (EODs and client reports that need a person). Every
 * other tool sits in System, one collapsed row. Managers get the desks they
 * work, plus their team tools.
 */
export type NavCounts = {
  home: number;
  escalations: number;
  /** EODs that need review. Shown on Review. */
  eods?: number;
  /** Reports in Ready for Review. Shown on Review. */
  reports?: number;
  /** Open academy holds. Shown on Holds. */
  holds?: number;
  /** Sales-operator applications that are new or in review. */
  applicants?: number;
};

const withBadge = (item: NavLeaf, count: number | undefined): NavLeaf =>
  count && count > 0 ? { ...item, badge: count } : item;

/** The staff home. Root, /workspace, and the old overview land here. */
export const STAFF_HOME = '/workspace/operators';

function operatorsDesk(counts?: NavCounts, role: 'admin' | 'manager' = 'admin'): NavSection {
  const queues: NavItem[] = [
    withBadge({ href: '/workspace/operators/applicants', label: 'Applicants', icon: MessagesSquare }, counts?.applicants),
    { href: '/workspace/operators/onboarding', label: 'Onboarding', icon: NotebookPen },
    { href: '/workspace/operators/ready', label: 'Ready', icon: CheckCircle2 },
    { href: '/workspace/operators', label: 'All operators', icon: Users },
  ];
  return {
    id: 'operators',
    heading: 'Operators',
    tone: 'violet',
    rail: 'tabs',
    href: '/workspace/operators',
    icon: Users,
    items: role === 'manager' ? queues.slice(1) : queues,
  };
}

function clientsDesk(counts?: NavCounts): NavSection {
  return {
    id: 'clients',
    heading: 'Clients',
    tone: 'amber',
    rail: 'tabs',
    href: '/workspace/clients',
    icon: Building2,
    items: [
      { href: '/workspace/clients/prospects', label: 'Prospects', icon: Compass },
      { href: '/workspace/clients', label: 'Case files', icon: Building2 },
      withBadge({ href: '/workspace/admin/escalations', label: 'Escalations', icon: CircleHelp }, counts?.escalations),
      { href: '/workspace/admin/bookings', label: 'Client bookings', icon: LayoutGrid },
    ],
  };
}

function placementsDesk(): NavSection {
  return {
    id: 'placements',
    heading: 'Placements',
    tone: 'sky',
    rail: 'tabs',
    href: '/workspace/placements',
    icon: Plug,
    items: [
      { href: '/workspace/placements', label: 'Live seats', icon: Plug },
      { href: '/workspace/placements/launches', label: 'Launches', icon: Send },
    ],
  };
}

function reviewDesk(counts?: NavCounts): NavSection {
  return {
    id: 'review',
    heading: 'Review',
    tone: 'emerald',
    rail: 'tabs',
    href: '/workspace/review/eods',
    icon: LayoutList,
    items: [
      withBadge({ href: '/workspace/review/eods', label: 'EODs', icon: Activity }, counts?.eods),
      withBadge({ href: '/workspace/review/reports', label: 'Client reports', icon: FileText }, counts?.reports),
    ],
  };
}

const TEAM_TOOLS: NavItem = {
  href: '/workspace/team/board',
  label: 'Team',
  icon: LayoutGrid,
  children: [
    { href: '/workspace/team/board', label: 'Board', icon: LayoutGrid },
    { href: '/workspace/team/queues', label: 'Queues', icon: MessagesSquare },
    { href: '/workspace/team/matching', label: 'Availability', icon: Compass },
    { href: '/workspace/team/scorecard', label: 'Scorecard', icon: Sparkles },
    { href: '/workspace/team', label: 'Roster and View As', icon: Users, exact: true, aliases: ['/workspace/admin/view-as'] },
    { href: '/workspace/team/workspace', label: 'Today', icon: Gauge, exact: true },
    { href: '/workspace/team/workspace/activity', label: 'Activity', icon: Activity },
    { href: '/workspace/operations', label: 'Operations overview', icon: Gauge },
    { href: '/workspace/inbox', label: 'Inbox', icon: MessagesSquare },
  ],
};

const ACADEMY_ITEM: NavItem = {
  href: '/workspace/academy',
  label: 'Academy',
  icon: Brain,
  children: [
    { href: '/workspace/academy/questions', label: 'Question bank', icon: BookOpen },
    { href: '/workspace/academy/quizzes', label: 'Quizzes', icon: NotebookPen },
    { href: '/workspace/academy/simulations', label: 'Simulations', icon: Bot },
    { href: '/workspace/academy/rubrics', label: 'Rubrics', icon: ScrollText },
    { href: '/workspace/academy/offers', label: 'Offer packs', icon: Megaphone },
    { href: '/workspace/academy/practicals', label: 'Practicals', icon: FileText },
    { href: '/workspace/academy/reflections', label: 'Reflections', icon: NotebookPen },
  ],
};

function holdsItem(count?: number): NavItem {
  return {
    href: '/workspace/academy/holds',
    label: 'Holds',
    icon: Scale,
    badge: count && count > 0 ? count : undefined,
    children: [
      { href: '/workspace/academy/holds/grading', label: 'Grading', icon: CheckCircle2 },
      { href: '/workspace/academy/holds/practicals', label: 'Practicals', icon: FileText },
      { href: '/workspace/academy/holds/summary', label: 'Summary', icon: Activity },
    ],
  };
}

function systemSection({ showAcademy, showHolds, counts }: { showAcademy: boolean; showHolds: boolean; counts?: NavCounts }): NavSection {
  const items: NavItem[] = [
    ...(showAcademy ? [ACADEMY_ITEM] : []),
    ...(showHolds ? [holdsItem(counts?.holds)] : []),
    {
      href: '/workspace/agreements',
      label: 'Agreements',
      icon: ScrollText,
      children: [{ href: '/workspace/recipients', label: 'Recipients', icon: Users }],
    },
    TEAM_TOOLS,
    {
      href: '/workspace/calls',
      label: 'Sales',
      icon: Megaphone,
      aliases: ['/workspace/hs/calls'],
      children: [
        { href: '/workspace/calls', label: 'Sales calls', icon: Megaphone, aliases: ['/workspace/hs/calls'] },
        { href: '/workspace/overview', label: 'VA performance', icon: Activity },
        { href: '/workspace/accounts', label: 'Accounts', icon: Building2, aliases: ['/workspace/practices', '/workspace/hs/companies'] },
        { href: '/workspace/bookings', label: 'Prospect bookings', icon: LayoutGrid },
        { href: '/workspace/booking-messages', label: 'Message problems', icon: CircleHelp },
        { href: '/workspace/calendar-links', label: 'Calendar links', icon: Compass },
        { href: '/workspace/acq-applications', label: 'Coaching applications', icon: FileText },
        { href: '/workspace/growth/ingestion', label: 'Ingestion', icon: Sparkles, aliases: ['/da/ingestion'] },
        { href: '/workspace/growth/messages', label: 'Messages', icon: MessagesSquare, aliases: ['/da/messages'] },
      ],
    },
    {
      href: '/workspace/team/ghl',
      label: 'GHL',
      icon: Link,
      children: [
        { href: '/workspace/team/ghl/access', label: 'Access', icon: ShieldCheck },
        { href: '/workspace/team/ghl/activity', label: 'Activity health', icon: Activity },
        { href: '/workspace/team/ghl/unattributed', label: 'Unattributed', icon: CircleHelp },
        { href: '/workspace/team/ghl/routing', label: 'Routing log', icon: Compass },
        { href: '/workspace/team/ghl/standard', label: 'Standard', icon: ScrollText },
      ],
    },
    {
      href: '/workspace/admin/payroll',
      label: 'Money',
      icon: Gauge,
      children: [
        { href: '/workspace/admin/payroll', label: 'Payroll', icon: Gauge },
        { href: '/workspace/growth/billing', label: 'Billing', icon: FileText, aliases: ['/da/billing'] },
        { href: '/workspace/growth/payouts', label: 'Payouts', icon: Gauge, aliases: ['/da/payouts'] },
        { href: '/workspace/growth/margin', label: 'Margin', icon: Gauge, aliases: ['/da/margin'] },
        ...(navSlots.payImpact ? [{ href: '/workspace/growth/pay-impact', label: 'Pay Impact', icon: Gauge }] : []),
      ],
    },
    {
      href: '/workspace/settings',
      label: 'Settings',
      icon: Settings,
      children: [
        { href: '/workspace/settings', label: 'Workspace settings', icon: Settings },
        { href: '/workspace/sales-ops/settings', label: 'Sales settings', icon: Settings, aliases: ['/workspace/sales-ops'] },
        { href: '/workspace/sales-ops/metrics', label: 'Metrics', icon: Activity },
        { href: '/workspace/sales-ops/targets', label: 'Targets', icon: Plug },
        { href: '/workspace/sales-ops/tasks', label: 'Tasks', icon: NotebookPen },
        { href: '/workspace/sales-ops/templates', label: 'Placement templates', icon: ScrollText },
        { href: '/workspace/team/settings', label: 'Team settings', icon: Settings },
        { href: '/workspace/templates', label: 'Templates', icon: ScrollText },
        { href: '/workspace/mapping', label: 'Field mapping', icon: NotebookPen },
        { href: '/workspace/admin/notifications', label: 'Notifications routing', icon: MessagesSquare },
        { href: '/workspace/team/workspace/integrity', label: 'Data integrity', icon: ShieldCheck },
        { href: '/workspace/team/workspace/reports/deliveries', label: 'Deliveries', icon: ScrollText },
      ],
    },
    {
      href: '/workspace/control',
      label: 'Control',
      icon: ShieldCheck,
      children: [
        { href: '/workspace/control', label: 'Overview', icon: ShieldCheck, exact: true },
        { href: '/workspace/control/invites', label: 'Invites', icon: Plus, aliases: ['/ad/invites', '/ad/invite'] },
        { href: '/workspace/control/alerts', label: 'Alerts', icon: CircleHelp },
        { href: '/workspace/control/audit', label: 'Audit', icon: ScrollText },
        { href: '/workspace/control/credentials', label: 'Credentials', icon: ShieldCheck },
        { href: '/workspace/control/lockdown', label: 'Lockdown', icon: ShieldCheck },
      ],
    },
  ];
  return { id: 'system', heading: 'System', tone: 'slate', rail: 'tabs', href: items[0].href, icon: Settings, items };
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
      operatorsDesk(counts, 'manager'),
      placementsDesk(),
      reviewDesk(counts),
      { id: 'team', heading: 'Team', tone: 'slate', rail: 'tabs', href: TEAM_TOOLS.href, icon: TEAM_TOOLS.icon, items: TEAM_TOOLS.children ?? [] },
    ];
  }
  return [operatorsDesk(counts), clientsDesk(counts), placementsDesk(), reviewDesk(counts), systemSection({ showAcademy, showHolds, counts })];
}

export { normalizePath } from './legacyRoutes';
import { normalizePath } from './legacyRoutes';

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
          // Longest match wins. At equal length a child beats its parent, so
          // the tab for the page itself is the one marked.
          const held = best as ActiveMatch | null;
          const better = href.length > bestLength || (href.length === bestLength && leaf !== item && held?.item === item && !held.child);
          if (matches(path, href, leaf.exact) && better) {
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
