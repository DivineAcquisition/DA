import type { ComponentType } from 'react';
import {
  Activity,
  Building2,
  FileText,
  Inbox,
  LayoutList,
  Link,
  Plug,
  Plus,
  Receipt,
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
 * The live delivery loop, and nothing else. Seat, client file, review, and
 * the account that runs it. Managers work the seat, the reviews, and the
 * operator record. The client file, invites, and the GoHighLevel token stay
 * with DA Admin.
 */
export type NavCounts = {
  home: number;
  escalations: number;
  /** EODs that need review. Shown on Review. */
  eods?: number;
  /** Reports in Ready for Review. Shown on Review. */
  reports?: number;
  /** Open academy holds. No longer shown. */
  holds?: number;
  /** Sales-operator applications. No longer shown. */
  applicants?: number;
};

const withBadge = (item: NavLeaf, count: number | undefined): NavLeaf =>
  count && count > 0 ? { ...item, badge: count } : item;

/** The staff home. Root and /workspace land on the live seat. */
export const STAFF_HOME = '/workspace/placements';

function seatDesk(): NavSection {
  return {
    id: 'seat',
    heading: 'Seat',
    tone: 'sky',
    href: '/workspace/placements',
    icon: Plug,
    items: [{ href: '/workspace/placements', label: 'Seat', icon: Plug }],
  };
}

function clientDesk(): NavSection {
  return {
    id: 'clients',
    heading: 'Client',
    tone: 'amber',
    href: '/workspace/clients',
    icon: Building2,
    items: [{ href: '/workspace/clients', label: 'Client', icon: Building2 }],
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

function pipelineDesk(): NavSection {
  return {
    id: 'pipeline',
    heading: 'Pipeline',
    tone: 'sky',
    href: '/workspace/pipeline',
    icon: Inbox,
    items: [{ href: '/workspace/pipeline', label: 'Pipeline', icon: Inbox }],
  };
}

function billingDesk(): NavSection {
  return {
    id: 'billing',
    heading: 'Billing',
    tone: 'fuchsia',
    href: '/workspace/billing',
    icon: Receipt,
    items: [{ href: '/workspace/billing', label: 'Billing', icon: Receipt }],
  };
}

function accountDesk(role: 'admin' | 'manager'): NavSection {
  const items: NavItem[] = [{ href: '/workspace/operators', label: 'Operators', icon: Users }];
  if (role === 'admin') {
    items.push(
      { href: '/workspace/control/invites', label: 'Invites', icon: Plus, aliases: ['/ad/invites', '/ad/invite'] },
      { href: '/workspace/team/ghl', label: 'GoHighLevel', icon: Link },
    );
  }
  return {
    id: 'account',
    heading: 'Account',
    tone: 'violet',
    rail: 'tabs',
    href: '/workspace/operators',
    icon: Users,
    items,
  };
}

export function buildNav({
  role = 'admin',
  counts,
}: {
  showAcademy?: boolean;
  showHolds?: boolean;
  holdsOnly?: boolean;
  role?: 'admin' | 'manager';
  counts?: NavCounts;
}): NavSection[] {
  const desks = [seatDesk(), reviewDesk(counts), accountDesk(role)];
  if (role === 'manager') return desks;
  return [seatDesk(), pipelineDesk(), clientDesk(), reviewDesk(counts), billingDesk(), accountDesk('admin')];
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

/** The single most specific entry for a path. Longest href wins. */
export function findActive(nav: NavSection[], pathname: string): ActiveMatch | null {
  const path = normalizePath(pathname);
  let best: ActiveMatch | null = null;
  let bestLength = -1;
  for (const section of nav) {
    for (const item of section.items) {
      for (const leaf of [item, ...(item.children ?? [])]) {
        for (const href of [leaf.href, ...(leaf.aliases ?? [])]) {
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
