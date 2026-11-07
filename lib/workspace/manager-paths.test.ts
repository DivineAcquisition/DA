import { describe, expect, it } from 'vitest';
import { managerPathAllowed } from './manager-paths';

describe('managerPathAllowed', () => {
  it('opens the operator file, placements, review, and team tools', () => {
    for (const path of [
      '/workspace/operators',
      '/workspace/operators/onboarding',
      '/workspace/operators/abc',
      '/workspace/placements',
      '/workspace/placements/abc',
      '/workspace/review/eods',
      '/workspace/review/reports/abc',
      '/workspace/operations',
      '/workspace/inbox',
      '/workspace/team/workspace',
      '/workspace/team/workspace/activity',
      '/workspace/team',
    ]) {
      expect(managerPathAllowed(path)).toBe(true);
    }
  });

  it('blocks applicants, clients, GHL, the operator domain, data integrity, deliveries, and settings', () => {
    for (const path of [
      '/workspace/operators/applicants',
      '/workspace/operators-elsewhere',
      '/workspace/clients',
      '/workspace/team/ghl',
      '/workspace/team/ghl/access',
      '/workspace/team/settings',
      '/workspace/team/workspace/integrity',
      '/workspace/team/workspace/reports/deliveries',
      '/workspace/sales-ops',
      '/workspace/sales-ops/settings',
      '/workspace/admin/payroll',
      '/workspace/control',
    ]) {
      expect(managerPathAllowed(path)).toBe(false);
    }
  });
});
