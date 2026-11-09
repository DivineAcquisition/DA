import { describe, expect, it } from 'vitest';
import { managerPathAllowed } from './manager-paths';

describe('managerPathAllowed', () => {
  it('opens the operator file, the live seat, and review', () => {
    for (const path of [
      '/workspace/operators',
      '/workspace/operators/abc',
      '/workspace/placements',
      '/workspace/placements/abc',
      '/workspace/placements/new',
      '/workspace/review/eods',
      '/workspace/review/reports/abc',
    ]) {
      expect(managerPathAllowed(path)).toBe(true);
    }
  });

  it('blocks the client file, invites, and the GoHighLevel token', () => {
    for (const path of [
      '/workspace/operators/applicants',
      '/workspace/operators-elsewhere',
      '/workspace/clients',
      '/workspace/clients/abc',
      '/workspace/control',
      '/workspace/control/invites',
      '/workspace/team/ghl',
      '/workspace/team/ghl/client/abc',
      '/workspace/team',
      '/workspace/sales-ops',
      '/workspace/admin/payroll',
    ]) {
      expect(managerPathAllowed(path)).toBe(false);
    }
  });
});
