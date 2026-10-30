import { describe, expect, it } from 'vitest';
import { managerPathAllowed } from './manager-paths';

describe('managerPathAllowed', () => {
  it('opens overview, team, placements, and inbox', () => {
    for (const path of [
      '/workspace/operations',
      '/workspace/inbox',
      '/workspace/team/workspace',
      '/workspace/team/workspace/eods',
      '/workspace/team/workspace/activity',
      '/workspace/sales-ops/placements',
      '/workspace/sales-ops/placements/abc',
      '/workspace/team',
    ]) {
      expect(managerPathAllowed(path)).toBe(true);
    }
  });

  it('blocks GHL, the operator domain, data integrity, deliveries, and the rest of sales ops', () => {
    for (const path of [
      '/workspace/team/ghl',
      '/workspace/team/ghl/access',
      '/workspace/team/settings',
      '/workspace/team/workspace/integrity',
      '/workspace/team/workspace/reports/deliveries',
      '/workspace/sales-ops',
      '/workspace/sales-ops/settings',
      '/workspace/sales-ops/eods',
      '/workspace/admin/payroll',
      '/workspace/control',
    ]) {
      expect(managerPathAllowed(path)).toBe(false);
    }
  });
});
