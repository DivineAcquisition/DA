import { describe, expect, it } from 'vitest';
import { appForHost, appForRole, appHosts, appUrl, isTeamAppPath, sessionRules } from './apps';

describe('apps', () => {
  it('reads each address from configuration only', () => {
    const env = {
      TEAM_APP_URL: 'https://va.example.test/',
      ADMIN_APP_URL: 'ops.example.test',
      TRAINING_APP_URL: 'https://learn.example.test/',
    };
    expect(appUrl('team', env)).toBe('https://va.example.test');
    expect(appUrl('admin', env)).toBe('https://ops.example.test');
    expect(appUrl('training', env)).toBe('https://learn.example.test');
    expect(appForHost('va.example.test', env)).toBe('team');
    expect(appForHost('OPS.example.test:443', env)).toBe('admin');
    expect(appForHost('learn.example.test', env)).toBe('training');
    expect(appForHost('elsewhere.test', env)).toBeNull();
  });

  it('defaults the training host when nothing is configured', () => {
    expect(appUrl('training', {})).toBe('https://training.divineacquisition.io');
    expect(appHosts('training', {})).toEqual(['training.divineacquisition.io']);
    expect(appForHost('training.divineacquisition.io', {})).toBe('training');
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
    const training = sessionRules('training', {});
    expect(admin.idle).toBeLessThan(team.idle);
    expect(admin.absolute).toBeLessThan(team.absolute);
    expect(training.idle).toBe(team.idle);
    expect(sessionRules('admin', { ADMIN_IDLE_MINUTES: '15' }).idle).toBe(15);
    expect(sessionRules('training', { TRAINING_IDLE_MINUTES: '45' }).idle).toBe(45);
  });
});
