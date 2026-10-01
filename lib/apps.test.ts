import { describe, expect, it } from 'vitest';
import { appForHost, appForRole, appHosts, appUrl, isTeamAppPath, sessionRules } from './apps';

describe('two apps', () => {
  it('reads each address from configuration only', () => {
    const env = { TEAM_APP_URL: 'https://va.example.test/', ADMIN_APP_URL: 'ops.example.test' };
    expect(appUrl('team', env)).toBe('https://va.example.test');
    expect(appUrl('admin', env)).toBe('https://ops.example.test');
    expect(appForHost('va.example.test', env)).toBe('team');
    expect(appForHost('OPS.example.test:443', env)).toBe('admin');
    expect(appForHost('elsewhere.test', env)).toBeNull();
  });

  it('keeps the older variable names working', () => {
    expect(appUrl('team', { TEAM_BASE_URL: 'https://t.test' })).toBe('https://t.test');
    expect(appHosts('admin', { DA_WORKSPACE_HOSTS: 'a.test,b.test' })).toEqual(['a.test', 'b.test']);
  });

  it('puts each role in exactly one app', () => {
    expect(appForRole('operator')).toBe('team');
    for (const role of ['owner', 'admin', 'manager']) expect(appForRole(role)).toBe('admin');
    expect(appForRole('client')).toBeNull();
  });

  it('serves only VA screens on the team app', () => {
    expect(isTeamAppPath('/vistrial/operator/pay')).toBe(true);
    expect(isTeamAppPath('/vistrial/auth/leave')).toBe(true);
    for (const path of ['/vistrial/team', '/vistrial/ops', '/vistrial/admin/payroll', '/vistrial/inbox', '/vistrial/team/ghl']) {
      expect(isTeamAppPath(path)).toBe(false);
    }
  });

  it('gives the admin app the stricter session', () => {
    const admin = sessionRules('admin', {});
    const team = sessionRules('team', {});
    expect(admin.idle).toBeLessThan(team.idle);
    expect(admin.absolute).toBeLessThan(team.absolute);
    expect(sessionRules('admin', { ADMIN_IDLE_MINUTES: '15' }).idle).toBe(15);
  });
});
