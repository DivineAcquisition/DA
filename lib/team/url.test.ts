import { afterEach, describe, expect, it } from 'vitest';
import { isVaPortalPath, teamOrigin, teamPath, teamUrl } from './url';

describe('team url', () => {
  afterEach(() => {
    delete process.env.TEAM_BASE_URL;
    delete process.env.TEAM_HOSTS;
  });

  it('strips the internal prefix', () => {
    expect(teamPath('/workspace')).toBe('/');
    expect(teamPath('/workspace/operator/pay')).toBe('/operator/pay');
    expect(teamPath('/operator')).toBe('/operator');
    expect(teamPath('/vistrialx')).toBe('/vistrialx');
  });

  it('builds absolute links on the team host', () => {
    expect(teamOrigin()).toBe('https://team.divineacquisition.io');
    expect(teamUrl('/workspace/operator/record', '?review=2026-10-06')).toBe(
      'https://team.divineacquisition.io/operator/record?review=2026-10-06',
    );
  });

  it('honours configuration', () => {
    process.env.TEAM_BASE_URL = 'https://team.example.test/';
    expect(teamUrl('/workspace')).toBe('https://team.example.test/');
  });

  it('keeps only VA and SDR pages on the team host', () => {
    expect(isVaPortalPath('/workspace')).toBe(false);
    expect(isVaPortalPath('/workspace/operator/record')).toBe(true);
    expect(isVaPortalPath('/workspace/auth/callback')).toBe(true);
    expect(isVaPortalPath('/workspace/reset-password')).toBe(true);
    expect(isVaPortalPath('/workspace/team/board')).toBe(false);
    expect(isVaPortalPath('/workspace/team/ghl')).toBe(false);
    expect(isVaPortalPath('/workspace/admin')).toBe(false);
    expect(isVaPortalPath('/workspace/inbox')).toBe(false);
    expect(isVaPortalPath('/workspace/operators')).toBe(false);
  });
});

