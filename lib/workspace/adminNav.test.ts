import { describe, expect, it } from 'vitest';
import { STAFF_HOME, buildNav, findActive, normalizePath, railRows, searchNav } from './adminNav';
import { legacyAdminRedirect } from './legacyRoutes';

const full = buildNav({});

function activeLabels(pathname: string, nav = full) {
  const match = findActive(nav, pathname);
  return match ? [match.section.heading, match.item.label, match.child?.label].filter(Boolean) : null;
}

const allHrefs = (nav: ReturnType<typeof buildNav>) =>
  nav.flatMap((section) => section.items.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]));

describe('normalizePath', () => {
  it('maps bare admin-host paths onto /workspace', () => {
    expect(normalizePath('/overview')).toBe('/workspace/overview');
    expect(normalizePath('/calls/abc')).toBe('/workspace/calls/abc');
  });

  it('keeps routed prefixes and strips trailing slashes', () => {
    expect(normalizePath('/workspace/operators/')).toBe('/workspace/operators');
    expect(normalizePath('/da/billing')).toBe('/da/billing');
    expect(normalizePath('/admin')).toBe('/admin');
    expect(normalizePath('/')).toBe('/');
  });
});

describe('the sidebar', () => {
  it('is the delivery loop, in order', () => {
    expect(full.map((section) => section.heading)).toEqual(['Seat', 'Pipeline', 'Client', 'Review', 'Billing', 'Account']);
    expect(full.flatMap((section) => railRows(section).map((row) => row.label))).toEqual([
      'Seat',
      'Pipeline',
      'Client',
      'Review',
      'Billing',
      'Account',
    ]);
  });

  it('opens the live seat as home', () => {
    expect(STAFF_HOME).toBe('/workspace/placements');
    expect(railRows(full[0])[0].href).toBe(STAFF_HOME);
  });

  it('lists review and account as tabs', () => {
    const labels = (id: string) => full.find((section) => section.id === id)?.items.map((item) => item.label);
    expect(labels('seat')).toEqual(['Seat']);
    expect(labels('clients')).toEqual(['Client']);
    expect(labels('review')).toEqual(['EODs', 'Client reports']);
    expect(labels('account')).toEqual(['Operators', 'Invites', 'GoHighLevel']);
  });

  it('keeps the old desks out of the nav', () => {
    const hrefs = allHrefs(full);
    for (const gone of [
      '/workspace/operators/applicants',
      '/workspace/operators/onboarding',
      '/workspace/operators/ready',
      '/workspace/clients/prospects',
      '/workspace/admin/escalations',
      '/workspace/admin/bookings',
      '/workspace/placements/launches',
      '/workspace/academy',
      '/workspace/team/board',
      '/workspace/team/queues',
      '/workspace/team/ghl/access',
      '/workspace/admin/payroll',
      '/workspace/settings',
      '/workspace/calls',
    ]) {
      expect(hrefs).not.toContain(gone);
    }
  });

  it('puts every entry on one URL', () => {
    const hrefs = full.flatMap((section) =>
      section.items.flatMap((item) => [item, ...(item.children ?? []).filter((child) => child.href !== item.href)].map((leaf) => leaf.href)),
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('carries the review count on Review', () => {
    const nav = buildNav({ counts: { home: 0, escalations: 2, eods: 3, reports: 1, applicants: 4 } });
    const rows = nav.flatMap((section) => railRows(section));
    expect(rows.find((row) => row.label === 'Review')?.badge).toBe(4);
    expect(rows.find((row) => row.label === 'Seat')?.badge).toBeUndefined();
    expect(rows.find((row) => row.label === 'Client')?.badge).toBeUndefined();
  });
});

describe('findActive', () => {
  it('lights the desk for the page that is open', () => {
    expect(activeLabels('/workspace/placements')).toEqual(['Seat', 'Seat']);
    expect(activeLabels('/workspace/placements/abc')).toEqual(['Seat', 'Seat']);
    expect(activeLabels('/workspace/placements/new')).toEqual(['Seat', 'Seat']);
    expect(activeLabels('/workspace/clients')).toEqual(['Client', 'Client']);
    expect(activeLabels('/workspace/clients/abc')).toEqual(['Client', 'Client']);
    expect(activeLabels('/workspace/operators')).toEqual(['Account', 'Operators']);
    expect(activeLabels('/workspace/operators/abc')).toEqual(['Account', 'Operators']);
    expect(activeLabels('/workspace/review/eods/abc')).toEqual(['Review', 'EODs']);
    expect(activeLabels('/workspace/review/reports/abc')).toEqual(['Review', 'Client reports']);
    expect(activeLabels('/workspace/control/invites')).toEqual(['Account', 'Invites']);
    expect(activeLabels('/ad/invite')).toEqual(['Account', 'Invites']);
    expect(activeLabels('/workspace/team/ghl')).toEqual(['Account', 'GoHighLevel']);
    expect(activeLabels('/workspace/team/ghl/client/abc')).toEqual(['Account', 'GoHighLevel']);
  });

  it('returns nothing for pages outside the nav', () => {
    expect(activeLabels('/workspace/login')).toBeNull();
    expect(activeLabels('/workspace/academy/holds')).toBeNull();
  });

  it('gives managers the seat, review, and the operator record', () => {
    const manager = buildNav({ role: 'manager' });
    expect(manager.map((section) => section.heading)).toEqual(['Seat', 'Review', 'Account']);
    const labels = manager.flatMap((section) => section.items.map((item) => item.label));
    expect(labels).toEqual(['Seat', 'EODs', 'Client reports', 'Operators']);
    for (const hidden of ['Pipeline', 'Client', 'Billing', 'Invites', 'GoHighLevel']) expect(labels).not.toContain(hidden);
  });
});

describe('searchNav', () => {
  it('finds the desks that remain', () => {
    expect(searchNav(full, 'eod').map((hit) => hit.leaf.label)).toEqual(['EODs']);
    expect(searchNav(full, 'gohighlevel').map((hit) => hit.leaf.label)).toEqual(['GoHighLevel']);
    expect(searchNav(full, 'payroll')).toEqual([]);
    expect(searchNav(full, '  ')).toEqual([]);
  });
});

describe('legacyAdminRedirect', () => {
  it('sends the workspace home to the live seat', () => {
    expect(legacyAdminRedirect('/workspace')).toBe('/workspace/placements');
  });

  it('sends old operator addresses to the operator record', () => {
    expect(legacyAdminRedirect('/workspace/onboarding')).toBe('/workspace/operators');
    expect(legacyAdminRedirect('/workspace/operators/applicants')).toBe('/workspace/operators');
    expect(legacyAdminRedirect('/workspace/operators/applicants/abc')).toBe('/workspace/operators');
    expect(legacyAdminRedirect('/workspace/operators/ready')).toBe('/workspace/operators');
    expect(legacyAdminRedirect('/workspace/team/workspace/operators')).toBe('/workspace/operators');
    expect(legacyAdminRedirect('/workspace/team/workspace/operators/new')).toBe('/workspace/operators');
    expect(legacyAdminRedirect('/workspace/team/workspace/operators/abc')).toBe('/workspace/operators/abc');
    expect(legacyAdminRedirect('/workspace/admin/operators/abc/')).toBe('/workspace/operators/abc');
    expect(legacyAdminRedirect('/workspace/team/operator/abc')).toBe('/workspace/operators/abc');
  });

  it('sends prospects and Growth to the client file, and keeps the pipeline', () => {
    expect(legacyAdminRedirect('/workspace/pipeline')).toBeNull();
    expect(legacyAdminRedirect('/workspace/pipeline/lead-1')).toBeNull();
    expect(legacyAdminRedirect('/workspace/clients/prospects')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/workspace/admin')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/workspace/admin/clients/c1')).toBe('/workspace/clients/c1');
    expect(legacyAdminRedirect('/workspace/growth')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/da')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/da/new')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/workspace/growth/billing')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/da/payouts')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/workspace/growth/lumen')).toBe('/workspace/clients/lumen');
    expect(legacyAdminRedirect('/workspace/growth/lumen/baseline')).toBe('/workspace/clients/lumen');
    expect(legacyAdminRedirect('/da/lumen')).toBe('/workspace/clients/lumen');
  });

  it('leaves auth screens alone', () => {
    expect(legacyAdminRedirect('/da/auth')).toBeNull();
    expect(legacyAdminRedirect('/da/forgot-password')).toBeNull();
    expect(legacyAdminRedirect('/workspace/login')).toBeNull();
  });

  it('sends placements, EODs, and reports to their desks', () => {
    expect(legacyAdminRedirect('/workspace/sales-ops/placements')).toBe('/workspace/placements');
    expect(legacyAdminRedirect('/workspace/sales-ops/placements/new')).toBe('/workspace/placements/new');
    expect(legacyAdminRedirect('/workspace/sales-ops/placements/p1')).toBe('/workspace/placements/p1');
    expect(legacyAdminRedirect('/workspace/team/workspace/launches')).toBe('/workspace/placements');
    expect(legacyAdminRedirect('/workspace/placements/launches')).toBe('/workspace/placements');
    expect(legacyAdminRedirect('/workspace/team/workspace/eods')).toBe('/workspace/review/eods');
    expect(legacyAdminRedirect('/workspace/sales-ops/eods/e1')).toBe('/workspace/review/eods/e1');
    expect(legacyAdminRedirect('/workspace/team/workspace/reports')).toBe('/workspace/review/reports');
    expect(legacyAdminRedirect('/workspace/team/workspace/reports/r1')).toBe('/workspace/review/reports/r1');
    expect(legacyAdminRedirect('/workspace/team/workspace/reports/deliveries')).toBe('/workspace/review/reports');
  });

  it('sends removed tools to the desk that replaced them', () => {
    expect(legacyAdminRedirect('/workspace/academy/holds/grading')).toBe('/workspace/operators');
    expect(legacyAdminRedirect('/workspace/team/queues')).toBe('/workspace/operators');
    expect(legacyAdminRedirect('/workspace/team/ghl/access')).toBe('/workspace/team/ghl');
    expect(legacyAdminRedirect('/workspace/team/ghl/standard')).toBe('/workspace/team/ghl');
    expect(legacyAdminRedirect('/workspace/admin/payroll')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/workspace/calls')).toBe('/workspace/placements');
    expect(legacyAdminRedirect('/workspace/settings')).toBe('/workspace/placements');
    expect(legacyAdminRedirect('/workspace/control')).toBe('/workspace/control/invites');
    expect(legacyAdminRedirect('/workspace/control/credentials')).toBe('/workspace/control/invites');
  });

  it('leaves current pages and the operator portal alone', () => {
    for (const path of [
      '/workspace/operators',
      '/workspace/operators/abc',
      '/workspace/clients',
      '/workspace/clients/c1',
      '/workspace/clients/new',
      '/workspace/placements',
      '/workspace/placements/p1',
      '/workspace/placements/new',
      '/workspace/review/eods',
      '/workspace/review/reports/r1',
      '/workspace/control/invites',
      '/workspace/team/ghl',
      '/workspace/team/ghl/client/abc',
      '/workspace/operator/workspace/eod',
      '/workspace/login',
    ]) {
      expect(legacyAdminRedirect(path)).toBeNull();
    }
  });

  it('lands every redirect on a page the nav knows', () => {
    const samples = [
      '/workspace/onboarding',
      '/da/lumen',
      '/workspace/team/workspace/eods/x',
      '/workspace/academy',
      '/workspace/team/ghl/routing',
      '/workspace/control/audit',
    ];
    for (const path of samples) {
      const target = legacyAdminRedirect(path)!.split('?')[0];
      expect(findActive(full, target), path).not.toBeNull();
    }
  });
});
