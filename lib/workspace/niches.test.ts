import { describe, expect, it } from 'vitest';
import {
  familyLabel,
  isHomeServicesNiche,
  isPracticeNiche,
  nicheFamily,
  nicheLabel,
  nichesForFamily,
  parseNiche,
  WORKSPACE_NICHES,
} from './niches';

describe('workspace niches', () => {
  it('covers practice types and home-services trades', () => {
    expect(WORKSPACE_NICHES).toContain('dental');
    expect(WORKSPACE_NICHES).toContain('med_spa');
    expect(WORKSPACE_NICHES).toContain('hvac');
    expect(WORKSPACE_NICHES).toContain('plumbing');
  });

  it('parses and labels niches by family', () => {
    expect(parseNiche('dental')).toBe('dental');
    expect(parseNiche('hvac')).toBe('hvac');
    expect(parseNiche('not-a-niche')).toBeNull();
    expect(isPracticeNiche('med_spa')).toBe(true);
    expect(isHomeServicesNiche('roofing')).toBe(true);
    expect(nicheFamily('dental')).toBe('practice');
    expect(nicheFamily('hvac')).toBe('home_services');
    expect(nicheLabel('dental')).toBe('Dental');
    expect(nicheLabel('hvac')).toBe('HVAC');
    expect(familyLabel('practice')).toBe('Practice');
    expect(nichesForFamily('practice')).toEqual(['dental', 'med_spa', 'both']);
  });
});
