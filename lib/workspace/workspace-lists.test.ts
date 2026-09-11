import { describe, expect, it } from 'vitest';
import { matchesWorkspaceSearch } from './workspace-list-types';

describe('matchesWorkspaceSearch', () => {
  it('matches contact, account, and niche label', () => {
    const row = {
      contact_name: 'Alex Rivera',
      account_name: 'Rivera HVAC',
      niche: 'hvac' as const,
    };
    expect(matchesWorkspaceSearch(row, 'alex')).toBe(true);
    expect(matchesWorkspaceSearch(row, 'HVAC')).toBe(true);
    expect(matchesWorkspaceSearch(row, 'home')).toBe(true);
    expect(matchesWorkspaceSearch(row, 'dental')).toBe(false);
  });
});
