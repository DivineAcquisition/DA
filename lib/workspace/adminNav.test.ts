import { describe, expect, it } from 'vitest';
import { STAFF_HOME, buildNav, findActive, normalizePath, railRows, searchNav } from './adminNav';
import { legacyAdminRedirect } from './legacyRoutes';

const full = buildNav({ showAcademy: true, showHolds: true, holdsOnly: false });

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
  it('is four desks in lifecycle order, then System', () => {
    expect(full.map((section) => section.heading)).toEqual(['Operators', 'Clients', 'Placements', 'Review', 'System']);
    expect(full.flatMap((section) => railRows(section).map((row) => row.label))).toEqual([
      'Operators',
      'Clients',
      'Placements',
      'Review',
      'System',
    ]);
  });

  it('opens Operators as home', () => {
    expect(STAFF_HOME).toBe('/workspace/operators');
    expect(railRows(full[0])[0].href).toBe(STAFF_HOME);
  });

  it('lists the desk queues as tabs, in order', () => {
    const labels = (id: string) => full.find((section) => section.id === id)?.items.map((item) => item.label);
    expect(labels('operators')).toEqual(['Applicants', 'Onboarding', 'Ready', 'All operators']);
    expect(labels('clients')).toEqual(['Prospects', 'Case files', 'Escalations', 'Client bookings']);
    expect(labels('placements')).toEqual(['Live seats', 'Launches']);
    expect(labels('review')).toEqual(['EODs', 'Client reports']);
  });

  it('keeps the wizard and the old front doors out of the nav', () => {
    const hrefs = allHrefs(full);
    expect(hrefs).not.toContain('/workspace/placements/new');
    for (const gone of [
      '/admin',
      '/workspace/onboarding',
      '/workspace/pipeline',
      '/workspace/growth',
      '/workspace/admin/clients',
      '/workspace/admin/operators',
      '/workspace/sales-ops/placements',
      '/workspace/team/workspace/eods',
      '/workspace/team/workspace/reports',
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

  it('carries action counts on the desks', () => {
    const nav = buildNav({
      showAcademy: false,
      showHolds: false,
      holdsOnly: false,
      counts: { home: 0, escalations: 2, eods: 3, reports: 1, applicants: 4 },
    });
    const rows = nav.flatMap((section) => railRows(section));
    expect(rows.find((row) => row.label === 'Operators')?.badge).toBe(4);
    expect(rows.find((row) => row.label === 'Clients')?.badge).toBe(2);
    expect(rows.find((row) => row.label === 'Review')?.badge).toBe(4);
    expect(rows.find((row) => row.label === 'Placements')?.badge).toBeUndefined();
  });
});

describe('findActive', () => {
  it('lights the desk for a case file and the queue for a queue', () => {
    expect(activeLabels('/workspace/operators')).toEqual(['Operators', 'All operators']);
    expect(activeLabels('/workspace/operators/0d8f4d0e')).toEqual(['Operators', 'All operators']);
    expect(activeLabels('/workspace/operators/applicants')).toEqual(['Operators', 'Applicants']);
    expect(activeLabels('/workspace/operators/applicants/abc')).toEqual(['Operators', 'Applicants']);
    expect(activeLabels('/workspace/operators/ready')).toEqual(['Operators', 'Ready']);
    expect(activeLabels('/workspace/clients/abc')).toEqual(['Clients', 'Case files']);
    expect(activeLabels('/workspace/clients/new')).toEqual(['Clients', 'Case files']);
    expect(activeLabels('/workspace/clients/prospects/abc')).toEqual(['Clients', 'Prospects']);
    expect(activeLabels('/workspace/placements/new')).toEqual(['Placements', 'Live seats']);
    expect(activeLabels('/workspace/placements/launches')).toEqual(['Placements', 'Launches']);
    expect(activeLabels('/workspace/review/eods/abc')).toEqual(['Review', 'EODs']);
    expect(activeLabels('/workspace/review/reports/abc')).toEqual(['Review', 'Client reports']);
  });

  it('keeps System tools reachable under one row', () => {
    expect(activeLabels('/workspace/academy/holds/grading')).toEqual(['System', 'Holds', 'Grading']);
    expect(activeLabels('/workspace/academy/questions/new')).toEqual(['System', 'Academy', 'Question bank']);
    expect(activeLabels('/workspace/academy/lessons/new')).toEqual(['System', 'Academy']);
    expect(activeLabels('/workspace/admin/payroll')).toEqual(['System', 'Money', 'Payroll']);
    expect(activeLabels('/da/margin')).toEqual(['System', 'Money', 'Margin']);
    expect(activeLabels('/workspace/settings')).toEqual(['System', 'Settings', 'Workspace settings']);
    expect(activeLabels('/workspace/sales-ops')).toEqual(['System', 'Settings', 'Sales settings']);
    expect(activeLabels('/workspace/sales-ops/metrics')).toEqual(['System', 'Settings', 'Metrics']);
    expect(activeLabels('/workspace/control')).toEqual(['System', 'Control', 'Overview']);
    expect(activeLabels('/workspace/control/credentials')).toEqual(['System', 'Control', 'Credentials']);
    expect(activeLabels('/ad/invite')).toEqual(['System', 'Control', 'Invites']);
    expect(activeLabels('/workspace/team/ghl/access')).toEqual(['System', 'GHL', 'Access']);
    expect(activeLabels('/workspace/team/queues')).toEqual(['System', 'Team', 'Queues']);
    expect(activeLabels('/workspace/team')).toEqual(['System', 'Team', 'Roster and View As']);
    expect(activeLabels('/workspace/hs/calls/new')).toEqual(['System', 'Sales', 'Sales calls']);
    expect(activeLabels('/accounts/123')).toEqual(['System', 'Sales', 'Accounts']);
    expect(activeLabels('/workspace/team/workspace/integrity')).toEqual(['System', 'Settings', 'Data integrity']);
  });

  it('returns nothing for pages outside the nav', () => {
    expect(activeLabels('/workspace/login')).toBeNull();
  });

  it('hides Academy entries the viewer cannot use', () => {
    const plain = buildNav({ showAcademy: false, showHolds: false, holdsOnly: false });
    expect(plain.flatMap((section) => section.items.map((item) => item.label))).not.toContain('Academy');
    expect(plain.map((section) => section.heading)).toEqual(['Operators', 'Clients', 'Placements', 'Review', 'System']);
    const reviewer = buildNav({ showAcademy: false, showHolds: false, holdsOnly: true });
    expect(reviewer.flatMap((section) => section.items.map((item) => item.label))).toEqual(['Holds']);
  });

  it('gives managers the desks they work and their team tools', () => {
    const manager = buildNav({ showAcademy: true, showHolds: true, holdsOnly: false, role: 'manager' });
    expect(manager.map((section) => section.heading)).toEqual(['Operators', 'Placements', 'Review', 'Team']);
    const labels = manager.flatMap((section) => section.items.map((item) => item.label));
    expect(labels).not.toContain('Applicants');
    expect(labels).toContain('EODs');
    for (const hidden of ['Data integrity', 'GHL', 'Payroll', 'Pay Impact', 'Case files']) expect(labels).not.toContain(hidden);
  });
});

describe('searchNav', () => {
  it('finds sub-pages by their parent or section name', () => {
    expect(searchNav(full, 'payroll').map((hit) => hit.leaf.label)).toContain('Payroll');
    expect(searchNav(full, 'applicants').map((hit) => hit.leaf.label)).toEqual(['Applicants']);
    expect(searchNav(full, 'credentials').map((hit) => hit.leaf.label)).toContain('Credentials');
    expect(searchNav(full, '  ')).toEqual([]);
  });
});

describe('legacyAdminRedirect', () => {
  it('sends old operator, onboarding, and hire addresses to the Operators desk', () => {
    expect(legacyAdminRedirect('/workspace')).toBe('/workspace/operators');
    expect(legacyAdminRedirect('/workspace/onboarding')).toBe('/workspace/operators/onboarding');
    expect(legacyAdminRedirect('/workspace/team/workspace/operators')).toBe('/workspace/operators');
    expect(legacyAdminRedirect('/workspace/team/workspace/operators/new')).toBe('/workspace/operators/applicants');
    expect(legacyAdminRedirect('/workspace/team/workspace/operators/abc')).toBe('/workspace/operators/abc');
    expect(legacyAdminRedirect('/workspace/admin/operators/abc/')).toBe('/workspace/operators/abc');
    expect(legacyAdminRedirect('/workspace/ops/operators')).toBe('/workspace/operators');
  });

  it('sends the pipeline, VA client admin, and Growth home to the Clients desk', () => {
    expect(legacyAdminRedirect('/workspace/pipeline')).toBe('/workspace/clients/prospects');
    expect(legacyAdminRedirect('/workspace/pipeline/lead-1')).toBe('/workspace/clients/prospects/lead-1');
    expect(legacyAdminRedirect('/workspace/admin')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/workspace/admin/clients')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/workspace/admin/clients/c1')).toBe('/workspace/clients/c1');
    expect(legacyAdminRedirect('/workspace/growth')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/da')).toBe('/workspace/clients');
    expect(legacyAdminRedirect('/da/new')).toBe('/workspace/clients/new');
    expect(legacyAdminRedirect('/workspace/growth/new')).toBe('/workspace/clients/new');
    expect(legacyAdminRedirect('/workspace/growth/lumen')).toBe('/workspace/clients/lumen?tab=growth');
    expect(legacyAdminRedirect('/da/lumen')).toBe('/workspace/clients/lumen?tab=growth');
  });

  it('leaves Growth tools and the case-file screens not yet moved alone', () => {
    for (const path of ['/workspace/growth/billing', '/da/payouts', '/workspace/growth/lumen/baseline', '/da/auth', '/workspace/growth/ingestion']) {
      expect(legacyAdminRedirect(path)).toBeNull();
    }
  });

  it('sends placements, EODs, and reports to their desks', () => {
    expect(legacyAdminRedirect('/workspace/sales-ops/placements')).toBe('/workspace/placements');
    expect(legacyAdminRedirect('/workspace/sales-ops/placements/new')).toBe('/workspace/placements/new');
    expect(legacyAdminRedirect('/workspace/sales-ops/placements/p1')).toBe('/workspace/placements/p1');
    expect(legacyAdminRedirect('/workspace/team/workspace/placements')).toBe('/workspace/placements');
    expect(legacyAdminRedirect('/workspace/team/workspace/launches')).toBe('/workspace/placements/launches');
    expect(legacyAdminRedirect('/workspace/team/workspace/eods')).toBe('/workspace/review/eods');
    expect(legacyAdminRedirect('/workspace/sales-ops/eods/e1')).toBe('/workspace/review/eods/e1');
    expect(legacyAdminRedirect('/workspace/team/workspace/reports')).toBe('/workspace/review/reports');
    expect(legacyAdminRedirect('/workspace/team/workspace/reports/r1')).toBe('/workspace/review/reports/r1');
    expect(legacyAdminRedirect('/workspace/team/workspace/reports/deliveries')).toBeNull();
  });

  it('leaves current pages and the operator portal alone', () => {
    for (const path of [
      '/workspace/operators',
      '/workspace/operators/abc',
      '/workspace/clients/c1',
      '/workspace/placements/p1',
      '/workspace/operator/workspace/onboarding',
      '/workspace/team/workspace',
      '/workspace/admin/payroll',
      '/workspace/sales-ops/settings',
    ]) {
      expect(legacyAdminRedirect(path)).toBeNull();
    }
  });

  it('lands every redirect on a page the nav knows', () => {
    const samples = ['/workspace/onboarding', '/workspace/pipeline/x', '/da/lumen', '/workspace/team/workspace/eods/x', '/workspace/ops/payroll'];
    for (const path of samples) {
      const target = legacyAdminRedirect(path)!.split('?')[0];
      expect(findActive(full, target)).not.toBeNull();
    }
  });
});
