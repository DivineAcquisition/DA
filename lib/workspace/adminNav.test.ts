import { describe, expect, it } from 'vitest';
import { buildNav, findActive, normalizePath, searchNav } from './adminNav';

const full = buildNav({ showAcademy: true, showHolds: true, holdsOnly: false });

function activeLabels(pathname: string, nav = full) {
  const match = findActive(nav, pathname);
  return match ? [match.section.heading, match.item.label, match.child?.label].filter(Boolean) : null;
}

describe('normalizePath', () => {
  it('maps bare admin-host paths onto /workspace', () => {
    expect(normalizePath('/overview')).toBe('/workspace/overview');
    expect(normalizePath('/calls/abc')).toBe('/workspace/calls/abc');
  });

  it('keeps routed prefixes and strips trailing slashes', () => {
    expect(normalizePath('/vistrial/ops/')).toBe('/vistrial/ops');
    expect(normalizePath('/da/billing')).toBe('/da/billing');
    expect(normalizePath('/admin')).toBe('/admin');
    expect(normalizePath('/')).toBe('/');
  });
});

describe('findActive', () => {
  it('picks one entry: team sub-pages no longer also light up the roster', () => {
    expect(activeLabels('/vistrial/team/queues')).toEqual(['Workspace', 'Sales operators', 'Queues']);
    expect(activeLabels('/vistrial/team')).toEqual(['Workspace', 'Sales operators', 'Roster & View As']);
  });

  it('separates Holds from the Academy it lives under', () => {
    expect(activeLabels('/workspace/academy/holds/grading')).toEqual(['Workspace', 'Holds', 'Grading']);
    expect(activeLabels('/workspace/academy/questions/new')).toEqual(['Workspace', 'Academy', 'Question bank']);
    expect(activeLabels('/workspace/academy/lessons/new')).toEqual(['Workspace', 'Academy']);
  });

  it('follows aliases and mirrored routes', () => {
    expect(activeLabels('/workspace/hs/calls/new')).toEqual(['Workspace', 'Sales']);
    expect(activeLabels('/workspace/ops/payroll')).toEqual(['Workspace', 'Sales operators', 'Payroll']);
    expect(activeLabels('/da/margin')).toEqual(['Workspace', 'Growth', 'Margin']);
    expect(activeLabels('/ad/invite')).toEqual(['Workspace', 'Sales operators', 'Invites']);
    expect(activeLabels('/accounts/123')).toEqual(['Workspace', 'Sales', 'Accounts']);
  });

  it('lights Pipeline for a lead page', () => {
    expect(activeLabels('/workspace/pipeline/abc')).toEqual(['Workspace', 'Pipeline']);
  });

  it('returns nothing for pages outside the nav', () => {
    expect(activeLabels('/workspace/login')).toBeNull();
  });

  it('keeps configuration screens out of the nav', () => {
    const hrefs = full.flatMap((section) =>
      section.items.flatMap((item) => [item, ...(item.children ?? [])].flatMap((leaf) => [leaf.href, ...(leaf.aliases ?? [])])),
    );
    for (const hidden of [
      '/workspace/settings',
      '/workspace/mapping',
      '/workspace/templates',
      '/workspace/control',
      '/workspace/control/credentials',
      '/workspace/control/lockdown',
      '/workspace/control/audit',
      '/workspace/control/alerts',
      '/workspace/growth/ingestion',
      '/vistrial/admin/notifications',
      '/vistrial/team/settings',
      '/vistrial/team/ghl',
      '/workspace/academy/import',
      '/workspace/academy/practice',
      '/workspace/academy/calibration',
      '/ad',
    ]) {
      expect(hrefs).not.toContain(hidden);
    }
    expect(activeLabels('/vistrial/team/ghl/access')).toBeNull();
    expect(activeLabels('/workspace/control/credentials')).toBeNull();
  });

  it('hides Academy entries the viewer cannot use', () => {
    const plain = buildNav({ showAcademy: false, showHolds: false, holdsOnly: false });
    expect(plain.some((section) => section.id === 'academy')).toBe(false);
    const reviewer = buildNav({ showAcademy: false, showHolds: false, holdsOnly: true });
    expect(reviewer.flatMap((section) => section.items.map((item) => item.label))).toEqual(['Holds']);
    const labels = full.flatMap((section) => section.items.map((item) => item.label));
    expect(labels).toEqual(['Overview', 'Pipeline', 'Clients', 'Sales operators', 'Team Workspace', 'Sales', 'Agreements', 'Growth', 'Academy', 'Holds']);
    expect(activeLabels('/vistrial/team/workspace')).toEqual(['Workspace', 'Team Workspace']);
    expect(activeLabels('/vistrial/team/workspace/operators/abc')).toEqual(['Workspace', 'Team Workspace']);
  });
});

describe('searchNav', () => {
  it('finds sub-pages by their parent or section name', () => {
    expect(searchNav(full, 'payroll').map((hit) => hit.leaf.label)).toEqual(['Payroll']);
    expect(searchNav(full, 'sales operators').map((hit) => hit.leaf.label)).toContain('View as');
    expect(searchNav(full, 'credentials')).toEqual([]);
    expect(searchNav(full, '  ')).toEqual([]);
  });
});
