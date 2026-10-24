import { describe, expect, it } from 'vitest';
import { LEAD_STAGES } from '@/lib/acq/stages';
import {
  APPOINTMENT_TAGS,
  LEGACY_TAGS,
  QUALIFICATION_TAGS,
  REVENUE_FIT_TAGS,
  SOURCE_TAGS,
  SPEND_QUALIFIED_TAGS,
  STAGE_TAGS,
  TAGS,
  exclusiveTagChange,
  hasTag,
  legacyNamesFor,
} from './tags';

const ALL = [
  ...Object.values(STAGE_TAGS),
  ...Object.values(QUALIFICATION_TAGS),
  ...Object.values(APPOINTMENT_TAGS),
  ...Object.values(SOURCE_TAGS),
  ...Object.values(TAGS),
  ...Object.values(SPEND_QUALIFIED_TAGS),
  ...Object.values(REVENUE_FIT_TAGS),
  ...Object.values(LEGACY_TAGS),
];

describe('GHL tags', () => {
  it('names every tag as lower-case "group - value"', () => {
    for (const tag of ALL) {
      expect(tag).toMatch(/^[a-z]+ - [a-z0-9][a-z0-9 ]*$/);
    }
    expect(STAGE_TAGS['Step 1 Captured']).toBe('lead - new');
  });

  it('has one stage tag per pipeline stage, all different', () => {
    expect(Object.keys(STAGE_TAGS).sort()).toEqual([...LEAD_STAGES].sort());
    expect(new Set(Object.values(STAGE_TAGS)).size).toBe(LEAD_STAGES.length);
  });

  it('keeps one tag per exclusive group and clears the old names', () => {
    const change = exclusiveTagChange(QUALIFICATION_TAGS, QUALIFICATION_TAGS.Qualified);
    expect(change.add).toEqual(['qualification - qualified']);
    expect(change.remove).toContain('qualification - disqualified');
    expect(change.remove).toContain('qualification - manual review');
    expect(change.remove).toContain('da-disqualified');
    expect(change.remove).toContain('da-qualified');
    expect(change.remove).not.toContain('qualification - qualified');

    const stage = exclusiveTagChange(STAGE_TAGS, STAGE_TAGS['Audit Booked']);
    expect(stage.remove).toHaveLength(LEAD_STAGES.length - 1);
  });

  it('reads legacy tags as their formal names', () => {
    expect(hasTag(['DA-Do-Not-Contact'], TAGS.doNotContact)).toBe(true);
    expect(hasTag(['consent - do not contact'], TAGS.doNotContact)).toBe(true);
    expect(hasTag(['da-audit-held'], APPOINTMENT_TAGS.held)).toBe(true);
    expect(hasTag(['lead - new'], TAGS.doNotContact)).toBe(false);
    expect(legacyNamesFor([SOURCE_TAGS.cleaning])).toEqual(['cleaning strategy session']);
  });
});
