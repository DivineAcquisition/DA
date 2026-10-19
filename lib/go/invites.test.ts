import { describe, expect, it } from 'vitest';
import { inviteForSlug, inviteUrl } from './invites';

describe('strategy invites', () => {
  it('finds Luis and Sam by slug', () => {
    expect(inviteForSlug('Luis')?.company).toBe('PLF Cleaning Solutions');
    expect(inviteForSlug('sam')?.fullName).toBe('Sam Gupta');
    expect(inviteForSlug('sam')?.timeZone).toBe('America/New_York');
    expect(inviteForSlug('luis')?.timeZone).toBe('America/Los_Angeles');
  });

  it('rejects an unknown invite', () => {
    expect(inviteForSlug('malik')).toBeNull();
    expect(inviteForSlug('')).toBeNull();
  });

  it('builds the public booking link', () => {
    expect(inviteUrl('luis')).toBe('https://go.divineacquisition.io/invite/luis');
    expect(inviteUrl('sam')).toBe('https://go.divineacquisition.io/invite/sam');
  });
});
