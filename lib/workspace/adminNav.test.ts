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
    expect(normalizePath('/workspace/operations/')).toBe('/workspace/operations');
    expect(normalizePath('/da/billing')).toBe('/da/billing');
    expect(normalizePath('/admin')).toBe('/admin');
    expect(normalizePath('/')).toBe('/');
  });
});

describe('findActive', () => {
  it('picks one entry: team sub-pages no longer also light up the roster', () => {
    expect(activeLabels('/workspace/team/queues')).toEqual(['Team', 'Queues']);
    expect(activeLabels('/workspace/team')).toEqual(['Team', 'Roster and View As']);
  });

  it('separates Holds from the Academy it lives under', () => {
    expect(activeLabels('/workspace/academy/holds/grading')).toEqual(['People', 'Holds', 'Grading']);
    expect(activeLabels('/workspace/academy/questions/new')).toEqual(['People', 'Academy', 'Question bank']);
    expect(activeLabels('/workspace/academy/lessons/new')).toEqual(['People', 'Academy']);
  });

  it('follows aliases and mirrored routes', () => {
    expect(activeLabels('/workspace/hs/calls/new')).toEqual(['Sales', 'Sales calls']);
    expect(activeLabels('/workspace/ops/payroll')).toEqual(['Finance', 'Payroll']);
    expect(activeLabels('/da/margin')).toEqual(['Finance', 'Margin']);
    expect(activeLabels('/ad/invite')).toEqual(['People', 'Invites']);
    expect(activeLabels('/accounts/123')).toEqual(['Sales', 'Sales calls', 'Accounts']);
  });

  it('lights Pipeline for a lead page', () => {
    expect(activeLabels('/workspace/pipeline/abc')).toEqual(['Sales', 'Pipeline']);
  });

  it('returns nothing for pages outside the nav', () => {
    expect(activeLabels('/workspace/login')).toBeNull();
  });

  it('gives configuration screens a home under Admin', () => {
    expect(activeLabels('/workspace/settings')).toEqual(['Admin', 'Workspace settings']);
    expect(activeLabels('/workspace/control/credentials')).toEqual(['Admin', 'Control', 'Credentials']);
    expect(activeLabels('/workspace/team/ghl/access')).toEqual(['Clients', 'GHL', 'Access']);
    expect(activeLabels('/workspace/team/settings')).toEqual(['Admin', 'Team settings']);
    expect(activeLabels('/workspace/growth/ingestion')).toEqual(['Sales', 'Ingestion']);
    expect(activeLabels('/workspace/team/workspace/integrity')).toEqual(['Admin', 'Data integrity']);
    expect(activeLabels('/workspace/sales-ops/placements/abc')).toEqual(['Team', 'Placements']);
    expect(activeLabels('/workspace/sales-ops')).toEqual(['Admin', 'Sales settings', 'Setup']);
  });

  it('hides Academy entries the viewer cannot use', () => {
    const plain = buildNav({ showAcademy: false, showHolds: false, holdsOnly: false });
    expect(plain.flatMap((section) => section.items.map((item) => item.label))).not.toContain('Academy');
    expect(plain.map((section) => section.heading)).toEqual(['Home', 'Team', 'People', 'Sales', 'Clients', 'Finance', 'Admin']);
    const reviewer = buildNav({ showAcademy: false, showHolds: false, holdsOnly: true });
    expect(reviewer.flatMap((section) => section.items.map((item) => item.label))).toEqual(['Holds']);
    expect(activeLabels('/workspace/team/workspace')).toEqual(['Team', 'Team Workspace']);
    expect(activeLabels('/workspace/team/workspace/operators/abc')).toEqual(['Team', 'Team Workspace']);
  });

  it('keeps the manager list to Home, Team, and Inbox', () => {
    const manager = buildNav({ showAcademy: true, showHolds: true, holdsOnly: false, role: 'manager' });
    expect(manager.map((section) => section.heading)).toEqual(['Home', 'Team', 'Inbox']);
    const labels = manager.flatMap((section) => section.items.map((item) => item.label));
    expect(labels).toContain('Placements');
    expect(labels).not.toContain('Data integrity');
    expect(labels).not.toContain('GHL');
    expect(labels).not.toContain('Payroll');
    expect(labels).not.toContain('Pay Impact');
  });
});

describe('searchNav', () => {
  it('finds sub-pages by their parent or section name', () => {
    expect(searchNav(full, 'payroll').map((hit) => hit.leaf.label)).toEqual(['Payroll']);
    expect(searchNav(full, 'operators').map((hit) => hit.leaf.label)).toContain('Operators');
    expect(searchNav(full, 'credentials').map((hit) => hit.leaf.label)).toContain('Credentials');
    expect(searchNav(full, '  ')).toEqual([]);
  });
});
