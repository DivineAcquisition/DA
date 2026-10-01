import { afterEach, describe, expect, it } from 'vitest';
import { isVaPortalPath, teamOrigin, teamPath, teamUrl } from './url';

describe('team url', () => {
  afterEach(() => {
    delete process.env.TEAM_BASE_URL;
    delete process.env.TEAM_HOSTS;
  });

  it('strips the internal prefix', () => {
    expect(teamPath('/vistrial')).toBe('/');
    expect(teamPath('/vistrial/operator/pay')).toBe('/operator/pay');
    expect(teamPath('/operator')).toBe('/operator');
    expect(teamPath('/vistrialx')).toBe('/vistrialx');
  });

  it('builds absolute links on the team host', () => {
    expect(teamOrigin()).toBe('https://team.divineacquisition.io');
    expect(teamUrl('/vistrial/operator/record', '?review=2026-10-06')).toBe(
      'https://team.divineacquisition.io/operator/record?review=2026-10-06',
    );
  });

  it('honours configuration', () => {
    process.env.TEAM_BASE_URL = 'https://team.example.test/';
    expect(teamUrl('/vistrial')).toBe('https://team.example.test/');
  });

  it('keeps only VA and SDR pages on the team host', () => {
    expect(isVaPortalPath('/vistrial')).toBe(true);
    expect(isVaPortalPath('/vistrial/operator/record')).toBe(true);
    expect(isVaPortalPath('/vistrial/auth/callback')).toBe(true);
    expect(isVaPortalPath('/vistrial/reset-password')).toBe(true);
    expect(isVaPortalPath('/vistrial/team/board')).toBe(false);
    expect(isVaPortalPath('/vistrial/team/ghl')).toBe(false);
    expect(isVaPortalPath('/vistrial/admin')).toBe(false);
    expect(isVaPortalPath('/vistrial/inbox')).toBe(false);
    expect(isVaPortalPath('/vistrial/operators')).toBe(false);
  });
});

