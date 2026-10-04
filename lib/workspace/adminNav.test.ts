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
  it('picks one entry: GHL pages no longer also light up the team roster', () => {
    expect(activeLabels('/vistrial/team/ghl/routing')).toEqual(['Team', 'GoHighLevel', 'Routing log']);
    expect(activeLabels('/vistrial/team/ghl')).toEqual(['Team', 'GoHighLevel']);
    expect(activeLabels('/vistrial/team')).toEqual(['Team', 'Team board', 'Roster & View As']);
  });

  it('separates Holds from the Academy it lives under', () => {
    expect(activeLabels('/workspace/academy/holds/grading')).toEqual(['Academy', 'Holds', 'Grading']);
    expect(activeLabels('/workspace/academy/questions/new')).toEqual(['Academy', 'Academy', 'Question bank']);
    expect(activeLabels('/workspace/academy/lessons/new')).toEqual(['Academy', 'Academy']);
  });

  it('follows aliases and mirrored routes', () => {
    expect(activeLabels('/workspace/hs/calls/new')).toEqual(['Sales', 'Calls']);
    expect(activeLabels('/workspace/ops/payroll')).toEqual(['Operations', 'Operators', 'Payroll']);
    expect(activeLabels('/da/margin')).toEqual(['Growth', 'Growth', 'Margin']);
    expect(activeLabels('/ad/invite')).toEqual(['Control', 'Control plane', 'Invites']);
    expect(activeLabels('/accounts/123')).toEqual(['Sales', 'Accounts']);
  });

  it('returns nothing for pages outside the nav', () => {
    expect(activeLabels('/workspace/login')).toBeNull();
  });

  it('hides Academy entries the viewer cannot use', () => {
    const plain = buildNav({ showAcademy: false, showHolds: false, holdsOnly: false });
    expect(plain.some((section) => section.id === 'academy')).toBe(false);
    const reviewer = buildNav({ showAcademy: false, showHolds: false, holdsOnly: true });
    expect(reviewer.flatMap((section) => section.items.map((item) => item.label))).toEqual(['Holds']);
  });
});

describe('searchNav', () => {
  it('finds sub-pages by their parent or section name', () => {
    expect(searchNav(full, 'payroll').map((hit) => hit.leaf.label)).toEqual(['Payroll']);
    expect(searchNav(full, 'ghl').map((hit) => hit.leaf.label)).toContain('GoHighLevel');
    expect(searchNav(full, 'gohighlevel').map((hit) => hit.leaf.label)).toContain('Routing log');
    expect(searchNav(full, '  ')).toEqual([]);
  });
});
