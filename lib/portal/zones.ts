import type { PortalContext, Stage } from './types';

/**
 * What a VA's account shows at each stage. The database already refuses the data
 * a stage may not have (a trainee gets no live placement, customer or lead at
 * all); this decides what the navigation offers and which pages explain
 * themselves instead of loading.
 */

export type TabKey =
  | 'today'
  | 'record'
  | 'bookings'
  | 'escalations'
  | 'reports'
  | 'standards'
  | 'commitments'
  | 'growth'
  | 'pay'
  | 'playbook'
  | 'tasks'
  | 'profile'
  | 'inbox'
  | 'agreements'
  | 'availability'
  | 'notice';

export type ZoneKey = 'today' | 'record' | 'standards' | 'commitments' | 'growth' | 'playbook' | 'pay' | 'agreements';

export type NavItem = { key: ZoneKey | TabKey; label: string; short: string; href: string };

const BASE = '/vistrial/operator';

const ZONE: Record<ZoneKey, NavItem> = {
  today: { key: 'today', label: 'My Day', short: 'My Day', href: BASE },
  record: { key: 'record', label: 'My Record', short: 'Record', href: `${BASE}/record` },
  standards: { key: 'standards', label: 'My Standards', short: 'Standards', href: `${BASE}/standards` },
  commitments: { key: 'commitments', label: "DA's Commitments", short: 'DA', href: `${BASE}/commitments` },
  growth: { key: 'growth', label: 'Pay & Growth', short: 'Pay & Growth', href: `${BASE}/growth` },
  playbook: { key: 'playbook', label: 'Sample Playbook', short: 'Playbook', href: `${BASE}/playbook` },
  pay: { key: 'pay', label: 'Pay', short: 'Pay', href: `${BASE}/pay` },
  agreements: { key: 'agreements', label: 'Agreements', short: 'Agreements', href: `${BASE}/agreements` },
};

const MENU: Record<'profile' | 'tasks' | 'inbox' | 'agreements' | 'availability', NavItem> = {
  profile: { key: 'profile', label: 'Profile', short: 'Profile', href: `${BASE}/profile` },
  tasks: { key: 'tasks', label: 'Tasks & Training', short: 'Tasks', href: `${BASE}/tasks` },
  inbox: { key: 'inbox', label: 'Notifications', short: 'Notifications', href: `${BASE}/inbox` },
  agreements: { key: 'agreements', label: 'Agreements', short: 'Agreements', href: `${BASE}/agreements` },
  availability: { key: 'availability', label: 'Availability', short: 'Availability', href: `${BASE}/availability` },
};

/** The bottom bar on a phone, the tab row on a desktop. */
export function zonesFor(context: Pick<PortalContext, 'stage' | 'has_history' | 'has_pay'>): NavItem[] {
  switch (context.stage) {
    case 'placed':
      return [ZONE.today, ZONE.record, ZONE.standards, ZONE.commitments, ZONE.growth];
    case 'waiting':
      // Certified or on bench. A VA whose placement ended keeps that history.
      return context.has_history
        ? [{ ...ZONE.today, label: 'Home', short: 'Home' }, ZONE.record, ZONE.standards, ZONE.commitments, ZONE.growth]
        : [{ ...ZONE.today, label: 'Home', short: 'Home' }, ZONE.standards, ZONE.growth];
    case 'training':
      return [{ ...ZONE.today, label: 'Training', short: 'Training' }, ZONE.playbook, ZONE.standards];
    case 'applicant':
      return [{ ...ZONE.today, label: 'Onboarding', short: 'Onboarding' }];
    case 'inactive':
      return [ZONE.pay, ZONE.agreements];
  }
}

/** The menu at the top of every screen. */
export function menuFor(context: Pick<PortalContext, 'stage'>): NavItem[] {
  switch (context.stage) {
    case 'placed':
    case 'waiting':
      return [MENU.profile, MENU.tasks, MENU.inbox, MENU.agreements, MENU.availability];
    case 'training':
      return [MENU.profile, { ...MENU.tasks, label: 'Training' }, MENU.inbox];
    case 'applicant':
      return [MENU.profile, MENU.agreements, MENU.inbox];
    case 'inactive':
      return [];
  }
}

/** Which zone a page belongs to, so the right one is highlighted. */
export function zoneOf(tab: TabKey): ZoneKey | null {
  switch (tab) {
    case 'today':
      return 'today';
    case 'record':
    case 'bookings':
    case 'escalations':
    case 'reports':
      return 'record';
    case 'standards':
      return 'standards';
    case 'commitments':
      return 'commitments';
    case 'growth':
    case 'pay':
      return 'growth';
    case 'playbook':
      return 'playbook';
    case 'agreements':
      return 'agreements';
    default:
      return null;
  }
}

const ALLOWED: Record<Stage, TabKey[]> = {
  placed: [
    'today', 'record', 'bookings', 'escalations', 'reports', 'standards', 'commitments', 'growth', 'pay', 'playbook',
    'tasks', 'profile', 'inbox', 'agreements', 'availability', 'notice',
  ],
  waiting: [
    'today', 'record', 'bookings', 'escalations', 'reports', 'standards', 'commitments', 'growth', 'pay', 'playbook',
    'tasks', 'profile', 'inbox', 'agreements', 'availability', 'notice',
  ],
  training: ['today', 'playbook', 'standards', 'tasks', 'profile', 'inbox', 'notice'],
  applicant: ['today', 'profile', 'inbox', 'agreements', 'notice'],
  inactive: ['pay', 'agreements', 'notice'],
};

/** Whether a page belongs in this stage's account at all. */
export function tabAllowed(stage: Stage, tab: TabKey, hasHistory = false): boolean {
  if (stage === 'waiting' && !hasHistory && ['record', 'bookings', 'escalations', 'reports', 'commitments'].includes(tab)) {
    return false;
  }
  return ALLOWED[stage].includes(tab);
}

/** Where an inactive VA lands: the first thing they still have. */
export function homeFor(stage: Stage): string {
  return stage === 'inactive' ? ZONE.pay.href : BASE;
}
